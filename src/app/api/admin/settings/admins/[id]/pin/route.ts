import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import bcrypt from 'bcrypt';
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
    const { pin } = body;

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

    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Upsert PIN
    const { error } = await supabase
      .from('admin_passworded_access')
      .upsert(
        {
          user_id: adminId,
          pin_hash: pinHash,
          granted_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'set_admin_pin',
      entityType: 'admin_passworded_access',
      entityId: adminId,
      oldValue: null,
      newValue: { has_pin: true },
      metadata: { admin_id: adminId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin-pin]', error);
    return handleApiError(error, 'Failed to set admin PIN');
  }
}
