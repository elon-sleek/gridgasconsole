import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get('buildingId');
  const tenantId = url.searchParams.get('tenantId');
  const claimedByFmId = url.searchParams.get('claimedByFmId');

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase.from('tenant_profiles').select('*').order('created_at', { ascending: false });

    if (buildingId) query = query.eq('building_id', buildingId);
    if (tenantId) query = query.eq('id', tenantId);
    if (claimedByFmId) query = query.eq('claimed_by_fm_id', claimedByFmId);

    const { data: tenants, error: tenantsError } = await query;
    if (tenantsError) throw tenantsError;

    const { data: fms, error: fmsError } = await supabase
      .from('fm_profiles')
      .select('id, full_name:name, email');
    if (fmsError) throw fmsError;

    const fmById = new Map<string, { id: string; full_name: string | null; email: string | null }>();
    (fms ?? []).forEach((fm: any) => {
      fmById.set(String(fm.id), {
        id: String(fm.id),
        full_name: typeof fm.full_name === 'string' ? fm.full_name : null,
        email: typeof fm.email === 'string' ? fm.email : null,
      });
    });

    const normalized = (tenants ?? []).map((t: any) => {
      const claimedById = t?.claimed_by_fm_id ? String(t.claimed_by_fm_id) : null;
      const claimStatus =
        typeof t?.claim_status === 'string'
          ? t.claim_status
          : claimedById
            ? 'claimed'
            : 'unclaimed';

      const fullName =
        typeof t?.full_name === 'string'
          ? t.full_name
          : typeof t?.name === 'string'
            ? t.name
            : null;

      return {
        ...t,
        full_name: fullName,
        claim_status: claimStatus,
        claimed_by_fm_id: claimedById,
        claimed_by_fm: claimedById ? fmById.get(claimedById) ?? null : null,
      };
    });

    const single = tenantId ? (normalized[0] ?? null) : null;
    return NextResponse.json({ ok: true, tenants: normalized, tenant: single });
  } catch (error: any) {
    console.error('[admin/tenants][GET]', error);
    return handleApiError(error, 'Failed to load tenants');
  }
}
