import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositivePricePerKg(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  let n: number;

  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, error: 'Price is required.' };
    n = Number(trimmed);
  }
  else return { ok: false, error: 'Price must be a number.' };

  if (!Number.isFinite(n)) return { ok: false, error: 'Price must be a valid number.' };
  if (n <= 0) return { ok: false, error: 'Price must be greater than 0.' };
  return { ok: true, value: n };
}

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const buildingIds = body.buildingIds;
  const pricePerKg = body.pricePerKg;

  if (!Array.isArray(buildingIds) || buildingIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one building.' }, { status: 400 });
  }

  const buildingIdsNormalized = buildingIds
    .filter((id: unknown): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (buildingIdsNormalized.length === 0) {
    return NextResponse.json({ error: 'Invalid building IDs.' }, { status: 400 });
  }

  const parsed = parsePositivePricePerKg(pricePerKg);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: oldOverrides } = await supabase
      .from('building_tariff_overrides')
      .select('*')
      .in('building_id', buildingIdsNormalized);

    const { data: buildings } = await supabase
      .from('buildings')
      .select('id, address, name')
      .in('id', buildingIdsNormalized);

    const buildingLabels = (Array.isArray(buildings) ? buildings : [])
      .map((b): { id: string; label: string } | null => {
        if (!isRecord(b)) return null;
        const idRaw = b.id;
        const addressRaw = b.address;
        const nameRaw = b.name;
        const id = String(idRaw ?? '').trim();
        if (!id) return null;
        const label = String(addressRaw ?? nameRaw ?? idRaw ?? id).trim();
        return { id, label: label || id };
      })
      .filter((x): x is { id: string; label: string } => x !== null);

    // Upsert overrides (one row per building_id)
    const overrides = buildingIdsNormalized.map((buildingId) => ({
      building_id: buildingId,
      rate_per_kg: parsed.value,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('building_tariff_overrides')
      .upsert(overrides, { onConflict: 'building_id' })
      .select();

    if (error) throw error;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_tariff',
      entityType: 'building_tariff_overrides',
      entityId: null,
      oldValue: (oldOverrides ?? null) as unknown as JsonValue,
      newValue: (data ?? null) as unknown as JsonValue,
      metadata: {
        scope: 'buildings',
        buildingIds: buildingIdsNormalized,
        buildingLabels,
        pricePerKg: parsed.value,
      } as unknown as JsonValue
    });

    return NextResponse.json({ 
      ok: true,
      overrides: data,
      count: data.length,
      message: `Updated prices for ${data.length} building(s)`
    });

  } catch (error: unknown) {
    console.error('[building-price-settings]', error);
    return handleApiError(error, 'Failed to update building prices');
  }
}

