import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

type Body = {
  vendorId: string;
  fmId: string;
  quantityKg: number;
  status?: 'ongoing' | 'completed' | 'cancelled';
  deliveredAt?: string | null;
  proofUrl?: string | null;
  note?: string | null;
};

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const fmId = url.searchParams.get('fmId');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 200);

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase
      .from('vendor_deliveries')
      .select(
        `
        id,
        vendor_id,
        fm_id,
        quantity_kg,
        delivered_at,
        status,
        created_at,
        gas_vendors (name)
      `.trim()
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fmId) query = query.eq('fm_id', fmId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, deliveries: data ?? [] });
  } catch (error: any) {
    console.error('[admin/vendor-deliveries][GET]', error);
    return handleApiError(error, 'Failed to load vendor deliveries');
  }
}

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Body;
  const vendorId = (body?.vendorId ?? '').trim();
  const fmId = (body?.fmId ?? '').trim();
  const quantityKg = Number(body?.quantityKg);

  if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
  if (!fmId) return NextResponse.json({ error: 'fmId is required' }, { status: 400 });
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: 'quantityKg must be > 0' }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const insertData = {
    vendor_id: vendorId,
    fm_id: fmId,
    quantity_kg: quantityKg,
    status: body.status ?? 'ongoing',
    delivered_at: body.deliveredAt ?? null,
    proof_url: body.proofUrl ?? null,
    note: body.note ?? null,
    created_by: user.id
  } as any;

  const { data, error } = await supabase
    .from('vendor_deliveries')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('[create-delivery]', error);
    return handleApiError(error, 'Failed to create vendor delivery');
  }

  // Log the audit trail
  await insertAdminAuditLog({
    req,
    actor: { id: user.id, email: user.email ?? null },
    action: 'created_delivery',
    entityType: 'vendor_delivery',
    entityId: data.id,
    oldValue: null,
    newValue: insertData,
  });

  return NextResponse.json({ id: data.id });
}
