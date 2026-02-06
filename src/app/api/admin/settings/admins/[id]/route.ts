import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolvedParams = await params;
    const adminId = resolvedParams.id;

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

    // Check target admin role (cannot delete super_admin)
    const { data: targetRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (targetRole?.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot delete super admin' },
        { status: 403 }
      );
    }

    // Get admin email for audit log
    const { data: adminData } = await supabase.auth.admin.getUserById(adminId);

    // Delete admin user via Supabase Admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(adminId);

    if (deleteError) throw deleteError;

    // Cascading deletes will handle admin_roles, admin_passworded_access, admin_user_preferences

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'deleted_admin',
      entityType: 'admin_user',
      entityId: adminId,
      oldValue: { email: adminData?.user?.email ?? null },
      newValue: null,
      metadata: { admin_id: adminId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[delete-admin]', error);
    return handleApiError(error, 'Failed to delete admin user');
  }
}
