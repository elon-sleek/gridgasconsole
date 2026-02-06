import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: tenantId } = await ctx.params;
  if (!tenantId) return NextResponse.json({ error: 'Tenant id is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenant_profiles')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantErr) throw tenantErr;
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const fullName =
      typeof (tenant as any)?.full_name === 'string'
        ? (tenant as any).full_name
        : typeof (tenant as any)?.name === 'string'
          ? (tenant as any).name
          : null;

    const normalizedTenant = {
      ...(tenant as any),
      full_name: fullName,
    };

    const tenantUserId = (tenant as any)?.user_id ?? null;

    const { data: purchases, error: purchasesErr } = await supabase
      .from('gas_purchases')
      .select('id,kg,amount_naira,status,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (purchasesErr) throw purchasesErr;

    const { data: balance, error: balanceErr } = tenantUserId
      ? await supabase
          .from('wallet_balances')
          .select('balance_naira,last_tx_at')
          .eq('user_id', tenantUserId)
          .maybeSingle()
      : { data: null, error: null };
    if (balanceErr) throw balanceErr;

    const { data: walletTx, error: walletTxErr } = tenantUserId
      ? await supabase
          .from('wallet_transactions')
          .select('id,tx_type,amount_naira,description,reference,created_at')
          .eq('user_id', tenantUserId)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [], error: null };
    if (walletTxErr) throw walletTxErr;

    const purchaseIds = (purchases ?? []).map((p: any) => p.id).filter(Boolean);

    const { data: vends, error: vendsErr } = purchaseIds.length
      ? await supabase
          .from('meter_vends')
          .select('id,purchase_id,token,status,sent_at,acknowledged_at,created_at')
          .in('purchase_id', purchaseIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [], error: null };

    if (vendsErr) throw vendsErr;

    return NextResponse.json({
      ok: true,
      tenant: normalizedTenant,
      purchases: purchases ?? [],
      tenantUserId,
      balance: balance ?? null,
      walletTransactions: walletTx ?? [],
      vends: vends ?? [],
    });
  } catch (error: any) {
    console.error('[admin/customers/:id][GET]', error);
    return handleApiError(error, 'Failed to load customer details');
  }
}
