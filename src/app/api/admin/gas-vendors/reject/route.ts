import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';

/**
 * POST /api/admin/gas-vendors/reject
 * 
 * Rejects a pending vendor profile (sets status to 'suspended').
 * Body: { profileId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Update vendor profile status to suspended (rejected)
    const { error } = await supabase
      .from('vendor_profiles')
      .update({ status: 'suspended' })
      .eq('id', profileId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the audit action
    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email },
      action: 'reject_vendor',
      entityType: 'vendor_profiles',
      entityId: profileId,
      metadata: {}
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error rejecting vendor:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
