import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

type AssignAssetsBody = {
  assetIds: string[];
  fmId: string;
  note?: string | null;
};

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as AssignAssetsBody;
  const assetIds = Array.isArray(body?.assetIds) ? body.assetIds.filter(Boolean) : [];
  const fmId = (body?.fmId ?? '').trim();

  if (!assetIds.length) return NextResponse.json({ error: 'assetIds is required' }, { status: 400 });
  if (!fmId) return NextResponse.json({ error: 'fmId is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  // Get FM details for audit log
  const { data: fm } = await supabase
    .from('fm_profiles')
    .select('full_name, email')
    .eq('id', fmId)
    .single();

  // Close any existing active assignments (idempotent with unique partial index)
  const { error: closeErr } = await supabase
    .from('asset_assignments')
    .update({ status: 'retrieved', retrieved_at: new Date().toISOString() } as any)
    .in('asset_id', assetIds)
    .eq('status', 'assigned')
    .is('retrieved_at', null);

  if (closeErr) {
    console.error('[assign-assets-close]', closeErr);
    return handleApiError(closeErr, 'Failed to close existing assignments');
  }

  const rows = assetIds.map((assetId) => ({
    asset_id: assetId,
    assigned_to_type: 'fm',
    assigned_to_fm_id: fmId,
    assigned_to_tenant_id: null,
    status: 'assigned',
    assigned_by: user.id,
    note: body.note ?? null
  }));

  const { error } = await supabase.from('asset_assignments').insert(rows);
  if (error) {
    console.error('[assign-assets]', error);
    return handleApiError(error, 'Failed to assign assets');
  }

  // Log the audit trail
  await insertAdminAuditLog({
    req,
    actor: { id: user.id, email: user.email ?? null },
    action: 'assigned_assets',
    entityType: 'asset_assignment',
    entityId: null, // Multiple assets
    oldValue: null,
    newValue: { assetIds, fmId, fm_name: fm?.full_name, fm_email: fm?.email },
    metadata: { count: assetIds.length, note: body.note } as any
  });

  return NextResponse.json({ ok: true });
}
