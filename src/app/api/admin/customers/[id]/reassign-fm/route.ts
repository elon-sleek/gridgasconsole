import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const tenantId = String(id ?? '').trim();
  if (!tenantId) return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 });

  const body = await req.json();
  const { fmId } = body;

  if (!fmId || typeof fmId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid fmId' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { data: oldTenant } = await supabase
      .from('tenant_profiles')
      .select('claimed_by_fm_id, claim_status')
      .eq('id', tenantId)
      .single();

    // Verify FM exists and is active
    const { data: fm, error: fmError } = await supabase
      .from('fm_profiles')
      .select('id, status')
      .eq('id', fmId)
      .single();

    if (fmError) throw fmError;
    if (fm.status !== 'active') {
      return NextResponse.json({ error: 'Selected FM is not active' }, { status: 400 });
    }

    // Update tenant's claimed_by_fm_id
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenant_profiles')
      .update({ 
        claimed_by_fm_id: fmId,
        claim_status: 'claimed',
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', tenantId)
      .select('id, full_name')
      .single();

    if (updateError) throw updateError;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'reassigned_tenant_fm',
      entityType: 'tenant_profiles',
      entityId: tenantId,
      oldValue: {
        claimed_by_fm_id: (oldTenant as any)?.claimed_by_fm_id ?? null,
        claim_status: (oldTenant as any)?.claim_status ?? null
      },
      newValue: { claimed_by_fm_id: fmId, claim_status: 'claimed' }
    });

    return NextResponse.json({ 
      ok: true,
      tenant: updatedTenant,
      message: 'Tenant reassigned successfully'
    });

  } catch (error: any) {
    console.error('[reassign-fm]', error);
    return handleApiError(error, 'Failed to reassign tenant');
  }
}
