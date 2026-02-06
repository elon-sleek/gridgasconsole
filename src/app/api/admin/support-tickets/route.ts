import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const fmId = url.searchParams.get('fmId');
  const tenantId = url.searchParams.get('tenantId');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 200);

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase
      .from('support_tickets')
      .select(
        `
        id,
        ticket_id,
        status,
        priority,
        subject,
        tenant_id,
        fm_id,
        created_at,
        tenant:tenant_profiles!tenant_id(full_name, customer_id, email)
      `.trim()
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fmId) query = query.eq('fm_id', fmId);
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) throw error;

    // Supabase can return joined rows either as object or array; normalize to a single object.
    const tickets = (data ?? []).map((row: any) => {
      const tenantRaw = row.tenant;
      const tenant = Array.isArray(tenantRaw) ? (tenantRaw[0] ?? null) : (tenantRaw ?? null);
      return { ...row, tenant };
    });

    return NextResponse.json({ ok: true, tickets });
  } catch (error: any) {
    console.error('[admin/support-tickets][GET]', error);
    return handleApiError(error, 'Failed to load support tickets');
  }
}
