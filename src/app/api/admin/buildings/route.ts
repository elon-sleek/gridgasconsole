import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';

function toNumberOrNull(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isMissingRelationshipError(err: any): boolean {
  const message = String(err?.message ?? err?.error_description ?? err ?? '').toLowerCase();
  return message.includes('could not find a relationship') || message.includes('relationship');
}

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const fmId = url.searchParams.get('fmId');
  const qRaw = url.searchParams.get('q');
  const limitRaw = url.searchParams.get('limit');

  const q = (qRaw ?? '').trim();
  const limit = (() => {
    const n = Number(limitRaw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(200, Math.floor(n)));
  })();

  const supabase = getSupabaseAdminClient();

  try {
    // Prefer joining FM details, but fall back if relationship isn't configured.
    let buildings: any[] = [];

    let buildingsWithFmQuery = supabase
      .from('buildings')
      .select(`*, fm_profiles (full_name:name, email)`);
    if (fmId) buildingsWithFmQuery = buildingsWithFmQuery.eq('fm_id', fmId);
    if (q) {
      const pattern = `%${q.replace(/%/g, '')}%`;
      buildingsWithFmQuery = buildingsWithFmQuery.or(`address.ilike.${pattern},name.ilike.${pattern}`);
    }
    if (limit > 0) buildingsWithFmQuery = buildingsWithFmQuery.limit(limit);

    const { data: buildingsWithFm, error: buildingsWithFmError } = await buildingsWithFmQuery;

    if (buildingsWithFmError) {
      if (!isMissingRelationshipError(buildingsWithFmError)) throw buildingsWithFmError;

      let buildingsNoFmQuery = supabase.from('buildings').select('*');
      if (fmId) buildingsNoFmQuery = buildingsNoFmQuery.eq('fm_id', fmId);
      if (q) {
        const pattern = `%${q.replace(/%/g, '')}%`;
        buildingsNoFmQuery = buildingsNoFmQuery.or(`address.ilike.${pattern},name.ilike.${pattern}`);
      }
      if (limit > 0) buildingsNoFmQuery = buildingsNoFmQuery.limit(limit);

      const { data: buildingsNoFm, error: buildingsNoFmError } = await buildingsNoFmQuery;
      if (buildingsNoFmError) throw buildingsNoFmError;
      buildings = buildingsNoFm ?? [];
    } else {
      buildings = buildingsWithFm ?? [];
    }

    const ids = buildings.map((b: any) => b?.id).filter(Boolean);
    const tenantCounts = new Map<string, number>();

    if (ids.length > 0) {
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenant_profiles')
        .select('building_id')
        .in('building_id', ids);
      if (tenantsError) throw tenantsError;

      (tenants ?? []).forEach((t: any) => {
        const id = t?.building_id;
        if (!id) return;
        tenantCounts.set(id, (tenantCounts.get(id) ?? 0) + 1);
      });
    }

    const normalized = buildings.map((b: any) => {
      const fm = Array.isArray(b.fm_profiles) ? b.fm_profiles[0] : b.fm_profiles ?? null;

      const latitude =
        toNumberOrNull(b?.latitude) ??
        toNumberOrNull(b?.lat);

      const longitude =
        toNumberOrNull(b?.longitude) ??
        toNumberOrNull(b?.lng) ??
        toNumberOrNull(b?.long) ??
        toNumberOrNull(b?.lon);

      return {
        id: b.id,
        address: b.address,
        lat: toNumberOrNull(b?.lat),
        lng: toNumberOrNull(b?.lng),
        latitude,
        longitude,
        photo_url: b.photo_url ?? null,
        fm_id: b.fm_id ?? null,
        created_at: b.created_at,
        fm_profiles: fm ? { full_name: fm.full_name ?? null, email: fm.email ?? null } : null,
        tenant_count: tenantCounts.get(b.id) ?? 0
      };
    });

    return NextResponse.json({ ok: true, buildings: normalized });
  } catch (error: any) {
    console.error('[admin/buildings][GET]', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load buildings',
        details: typeof error?.details === 'string' ? error.details : null,
        hint: typeof error?.hint === 'string' ? error.hint : null,
        code: typeof error?.code === 'string' ? error.code : null
      },
      { status: 500 }
    );
  }
}
