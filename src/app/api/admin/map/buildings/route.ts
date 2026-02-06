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

  const supabase = getSupabaseAdminClient();

  try {
    // Prefer joining FM details, but fall back if relationship isn't configured.
    let buildings: any[] | null = null;
    const { data: buildingsWithFm, error: buildingsWithFmError } = await supabase
      .from('buildings')
      .select(`*, fm_profiles (full_name:name, email)`);

    if (buildingsWithFmError) {
      if (!isMissingRelationshipError(buildingsWithFmError)) throw buildingsWithFmError;

      const { data: buildingsNoFm, error: buildingsNoFmError } = await supabase.from('buildings').select('*');
      if (buildingsNoFmError) throw buildingsNoFmError;
      buildings = buildingsNoFm ?? [];
    } else {
      buildings = buildingsWithFm ?? [];
    }

    // Filter out rows without coordinates in JS to avoid query-builder incompatibilities.
    buildings = (buildings ?? []).filter((b: any) => {
      const latitude = toNumberOrNull(b?.latitude) ?? toNumberOrNull(b?.lat);
      const longitude =
        toNumberOrNull(b?.longitude) ??
        toNumberOrNull(b?.lng) ??
        toNumberOrNull(b?.long) ??
        toNumberOrNull(b?.lon);
      return latitude != null && longitude != null;
    });

    const ids = (buildings ?? []).map((b: any) => b.id).filter(Boolean);

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

    const normalized = (buildings ?? []).map((b: any) => {
      const fm = Array.isArray(b.fm_profiles) ? b.fm_profiles[0] : b.fm_profiles ?? null;

      const latitude = toNumberOrNull(b?.latitude) ?? toNumberOrNull(b?.lat);
      const longitude =
        toNumberOrNull(b?.longitude) ??
        toNumberOrNull(b?.lng) ??
        toNumberOrNull(b?.long) ??
        toNumberOrNull(b?.lon);

      return {
        id: b.id,
        address: b.address,
        latitude,
        longitude,
        fm_id: b.fm_id ?? null,
        fm_name: fm?.full_name ?? null,
        fm_email: fm?.email ?? null,
        tenant_count: tenantCounts.get(b.id) ?? 0
      };
    });

    return NextResponse.json({ ok: true, buildings: normalized });
  } catch (error: any) {
    console.error('Map buildings load failed:', error);
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
