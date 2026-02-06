import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

type CreateAssetBody = {
  type: 'meter' | 'tank' | 'changeover';
  meterNumber?: string | null;
  serial?: string | null;
  manufacturer?: string | null;
  firmwareVersion?: string | null;
  capacityKg?: number | null;
  buildingId?: string | null;
  installAddress?: string | null;
};

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get('buildingId');

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase
      .from('assets')
      .select('id, type, serial, meter_id, capacity_kg, building_id, install_address, created_at')
      .order('created_at', { ascending: false });

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, assets: data ?? [] });
  } catch (error: any) {
    console.error('[admin/assets][GET]', error);
    return handleApiError(error, 'Failed to load assets');
  }
}

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as CreateAssetBody;
  if (!body?.type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

  if (body.capacityKg != null) {
    if (typeof body.capacityKg !== 'number' || !Number.isFinite(body.capacityKg)) {
      return NextResponse.json({ error: 'capacityKg must be a valid number' }, { status: 400 });
    }
    if (body.capacityKg < 0) {
      return NextResponse.json({ error: 'capacityKg cannot be negative' }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdminClient();

  let meterId: string | null = null;
  let serial: string | null = body.serial ?? null;

  if (body.type === 'meter') {
    const meterNumber = (body.meterNumber ?? '').trim();
    if (!meterNumber) return NextResponse.json({ error: 'meterNumber is required for meter assets' }, { status: 400 });

    const { data: meter, error } = await supabase
      .from('meters')
      .select('id, meter_number')
      .eq('meter_number', meterNumber)
      .maybeSingle();

    if (error) {
      console.error('[create-asset-meter-lookup]', error);
      return handleApiError(error, 'Failed to lookup meter');
    }
    if (!meter?.id) return NextResponse.json({ error: `Meter not found: ${meterNumber}` }, { status: 404 });

    meterId = meter.id as string;
    serial = meter.meter_number as string;
  } else {
    serial = (serial ?? '').trim() || null;
    if (!serial) return NextResponse.json({ error: 'serial is required for non-meter assets' }, { status: 400 });
  }

  const insertRow: any = {
    type: body.type,
    meter_id: meterId,
    serial,
    manufacturer: body.manufacturer ?? null,
    firmware_version: body.firmwareVersion ?? null,
    capacity_kg: body.capacityKg ?? null,
    building_id: body.buildingId ?? null,
    install_address: body.installAddress ?? null,
    created_by: user.id
  };

  const { data, error } = await supabase.from('assets').insert(insertRow).select('id').single();
  if (error) {
    console.error('[create-asset]', error);
    return handleApiError(error, 'Failed to create asset');
  }

  // Log the audit trail
  await insertAdminAuditLog({
    req,
    actor: { id: user.id, email: user.email ?? null },
    action: 'created_asset',
    entityType: 'asset',
    entityId: data.id,
    oldValue: null,
    newValue: insertRow,
  });

  return NextResponse.json({ id: data.id });
}
