import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

function isMissingRelationshipError(err: any): boolean {
  const message = String(err?.message ?? err?.error_description ?? err ?? '').toLowerCase();
  return message.includes('could not find a relationship') || message.includes('relationship');
}

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: vendors, error: vendorsError } = await supabase
      .from('gas_vendors')
      .select('*')
      .order('created_at', { ascending: false });
    if (vendorsError) throw vendorsError;

    // Prefer joining gas_vendors, but fall back if relationship isn't configured.
    let pendingProfiles: any[] = [];
    const { data: pendingWithVendor, error: pendingWithVendorError } = await supabase
      .from('vendor_profiles')
      .select(`
        *,
        gas_vendors(id, name, plant_location, capacity_kg, plant_lat, plant_lng, verified_at, active)
      `)
      .eq('status', 'pending_verification')
      .order('created_at', { ascending: false });

    if (pendingWithVendorError) {
      if (!isMissingRelationshipError(pendingWithVendorError)) throw pendingWithVendorError;
      const { data: pendingNoVendor, error: pendingNoVendorError } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });
      if (pendingNoVendorError) throw pendingNoVendorError;
      pendingProfiles = pendingNoVendor ?? [];
    } else {
      pendingProfiles = pendingWithVendor ?? [];
    }

    return NextResponse.json({ ok: true, vendors: vendors ?? [], pendingProfiles });
  } catch (error: any) {
    console.error('[admin/gas-vendors][GET]', error);
    return handleApiError(error, 'Failed to load gas vendors');
  }
}

type Body = {
  name: string;
  plantLocation?: string | null;
  capacityKg?: number | null;
  active?: boolean | null;
};

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Body;
  const name = (body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const insertData = {
    name,
    plant_location: body.plantLocation ?? null,
    capacity_kg: body.capacityKg ?? null,
    active: body.active ?? true,
    created_by: user.id
  } as any;

  const { data, error } = await supabase
    .from('gas_vendors')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('[create-vendor]', error);
    return handleApiError(error, 'Failed to create gas vendor');
  }

  // Log the audit trail
  await insertAdminAuditLog({
    req,
    actor: { id: user.id, email: user.email ?? null },
    action: 'created_vendor',
    entityType: 'gas_vendor',
    entityId: data.id,
    oldValue: null,
    newValue: insertData,
  });

  return NextResponse.json({ id: data.id });
}
