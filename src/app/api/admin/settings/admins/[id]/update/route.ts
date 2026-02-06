import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { randomBytes } from 'crypto';
import { handleApiError } from '@/lib/errorHandling';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const adminId = String(resolvedParams.id ?? '').trim();
    if (!adminId) return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });

    const body = await request.json();
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : null;
    const suspended = typeof body?.suspended === 'boolean' ? body.suspended : null;
    const removePasswordedAccess = body?.remove_passworded_access === true;
    const forceResetPassword = body?.force_reset_password === true;

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

    const { data: targetRoleRow } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', adminId)
      .maybeSingle();
    const targetRole = targetRoleRow?.role ?? null;

    if (targetRole === 'super_admin') {
      if (suspended === true) {
        return NextResponse.json({ error: 'Cannot suspend a super admin' }, { status: 400 });
      }
      if (removePasswordedAccess) {
        return NextResponse.json({ error: 'Cannot remove passworded access for a super admin' }, { status: 400 });
      }
      if (forceResetPassword) {
        return NextResponse.json({ error: 'Cannot force-reset password for a super admin' }, { status: 400 });
      }
    }

    // Snapshot old values for audit log
    const { data: targetUser } = await supabase.auth.admin.getUserById(adminId);
    const oldFullName = (targetUser?.user?.user_metadata as any)?.full_name ?? null;
    const oldBannedUntil = (targetUser?.user as any)?.banned_until ?? null;

    const updatesApplied: Record<string, any> = {};
    const oldValue: Record<string, any> = { full_name: oldFullName, banned_until: oldBannedUntil };

    if (fullName != null) {
      await supabase.auth.admin.updateUserById(adminId, {
        user_metadata: { ...(targetUser?.user?.user_metadata as any), full_name: fullName },
      } as any);
      updatesApplied.full_name = fullName;
    }

    if (suspended != null) {
      // Supabase Admin API supports ban_duration (e.g. 'none', '24h', '876000h')
      await supabase.auth.admin.updateUserById(adminId, {
        ban_duration: suspended ? '876000h' : 'none',
      } as any);
      updatesApplied.suspended = suspended;
    }

    if (removePasswordedAccess) {
      await supabase.from('admin_passworded_access').delete().eq('user_id', adminId);
      updatesApplied.passworded_access = false;
    }

    let temporaryPassword: string | null = null;
    if (forceResetPassword) {
      temporaryPassword = randomBytes(12).toString('base64url');
      await supabase.auth.admin.updateUserById(adminId, {
        password: temporaryPassword,
      } as any);
      updatesApplied.force_reset_password = true;
    }

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_admin',
      entityType: 'admin_user',
      entityId: adminId,
      oldValue,
      newValue: updatesApplied,
    });

    return NextResponse.json({ success: true, updated: updatesApplied, temporary_password: temporaryPassword });
  } catch (error: any) {
    console.error('[update-admin]', error);
    return handleApiError(error, 'Failed to update admin user');
  }
}
