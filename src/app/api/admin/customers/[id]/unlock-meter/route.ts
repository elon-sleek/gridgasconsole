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

  const supabase = getSupabaseAdminClient();

  try {
    // Get tenant's meter_id
    const { data: tenant, error: tenantError } = await supabase
      .from('tenant_profiles')
      .select('meter_id')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;
    if (!tenant?.meter_id) {
      return NextResponse.json({ error: 'No meter found for this tenant' }, { status: 400 });
    }

    // Unlock the meter
    const { data: updatedMeter, error: updateError } = await supabase
      .from('meters')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', tenant.meter_id)
      .select('id')
      .single();

    if (updateError) throw updateError;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'unlocked_meter',
      entityType: 'meters',
      entityId: updatedMeter.id,
      oldValue: null,
      newValue: { status: 'active' },
      metadata: { tenant_id: tenantId }
    });

    return NextResponse.json({ 
      ok: true,
      meterId: updatedMeter.id,
      message: 'Meter unlocked successfully'
    });

  } catch (error: any) {
    console.error('[unlock-meter]', error);
    return handleApiError(error, 'Failed to unlock meter');
  }
}
