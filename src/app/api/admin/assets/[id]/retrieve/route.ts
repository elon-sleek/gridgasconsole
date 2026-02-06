import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const assetId = String(id ?? '').trim();
  if (!assetId) return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  const nowIso = new Date().toISOString();

  // Close any active assignment (idempotent)
  const { data, error } = await supabase
    .from('asset_assignments')
    .update({ status: 'retrieved', retrieved_at: nowIso, updated_at: nowIso } as any)
    .eq('asset_id', assetId)
    .eq('status', 'assigned')
    .is('retrieved_at', null)
    .select('id');

  if (error) {
    console.error('[retrieve-asset]', error);
    return handleApiError(error, 'Failed to retrieve asset');
  }

  // Log the audit trail
  if (data && data.length > 0) {
    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'retrieved_asset',
      entityType: 'asset',
      entityId: assetId,
      oldValue: { status: 'assigned' },
      newValue: { status: 'retrieved' },
      metadata: { assignment_ids: data.map(d => d.id) }
    });
  }

  return NextResponse.json({ ok: true, retrievedCount: (data ?? []).length });
}
