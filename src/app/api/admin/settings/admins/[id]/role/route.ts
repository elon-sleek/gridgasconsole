import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolvedParams = await params;
    const adminId = resolvedParams.id;
    const body = await request.json();
    const { role } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if current user is super admin
    const { data: currentRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (currentRole?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get old role
    const { data: oldRoleData } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    // Update role
    const { error } = await supabase
      .from('admin_roles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', adminId);

    if (error) throw error;

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_admin_role',
      entityType: 'admin_roles',
      entityId: adminId,
      oldValue: { role: oldRoleData?.role ?? null },
      newValue: { role },
      metadata: { admin_id: adminId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin-role]', error);
    return handleApiError(error, 'Failed to update admin role');
  }
}
