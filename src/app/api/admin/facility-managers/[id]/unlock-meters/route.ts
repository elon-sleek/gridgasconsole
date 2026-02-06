import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const fmId = String(id ?? '').trim();
  if (!fmId) return NextResponse.json({ error: 'Missing FM id' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    // Get all tenants claimed by this FM
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenant_profiles')
      .select('id, meter_id')
      .eq('claimed_by_fm_id', fmId);

    if (tenantsError) throw tenantsError;

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ 
        message: 'No tenants found for this FM',
        unlockedCount: 0 
      });
    }

    // Get meter IDs (filter out nulls)
    const meterIds = tenants
      .map(t => t.meter_id)
      .filter((id): id is string => id != null && id !== '');

    if (meterIds.length === 0) {
      return NextResponse.json({ 
        message: 'No meters found for this FM\'s tenants',
        unlockedCount: 0 
      });
    }

    // Unlock all meters by updating status back to active
    const { data: updatedMeters, error: updateError } = await supabase
      .from('meters')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      } as any)
      .in('id', meterIds)
      .select('id');

    if (updateError) throw updateError;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'unlocked_all_meters_for_fm',
      entityType: 'fm_profiles',
      entityId: fmId,
      oldValue: null,
      newValue: { unlocked_count: updatedMeters?.length || 0 },
      metadata: { meter_ids_count: meterIds.length }
    });

    return NextResponse.json({ 
      ok: true,
      unlockedCount: updatedMeters?.length || 0,
      message: `Unlocked ${updatedMeters?.length || 0} meter(s)`
    });

  } catch (error: any) {
    console.error('[unlock-meters]', error);
    return handleApiError(error, 'Failed to unlock meters');
  }
}
