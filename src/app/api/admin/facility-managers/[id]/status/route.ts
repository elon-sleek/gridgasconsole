import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

type Body = { status: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const status = (body?.status ?? '').trim();
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  // Get old status for audit log
  const { data: oldFm } = await supabase
    .from('fm_profiles')
    .select('status, full_name, email')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('fm_profiles').update({ status } as any).eq('id', id);
  if (error) {
    console.error('[fm-status]', error);
    return handleApiError(error, 'Failed to update FM status');
  }

  // Log the audit trail
  await insertAdminAuditLog({
    req,
    actor: { id: user.id, email: user.email ?? null },
    action: status === 'blocked' ? 'blocked_fm' : 'unblocked_fm',
    entityType: 'fm_profile',
    entityId: id,
    oldValue: { status: oldFm?.status },
    newValue: { status },
    metadata: {
      fm_name: oldFm?.full_name,
      fm_email: oldFm?.email
    }
  });

  return NextResponse.json({ ok: true });
}
