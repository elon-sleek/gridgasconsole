import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: vendorId } = await ctx.params;
  if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: vendor, error: vendorError } = await supabase
      .from('gas_vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (vendorError) throw vendorError;

    const { data: profile, error: profileError } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (profileError) throw profileError;

    const { data: currentPriceRow, error: currentPriceError } = await supabase
      .from('vendor_current_prices')
      .select('*')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    // If vendor_current_prices is missing or has no row, treat as null.
    if (currentPriceError) {
      // Don’t fail the entire page for pricing issues.
      console.warn('[admin/gas-vendors/:id] current price error', currentPriceError);
    }

    const { data: priceHistory, error: historyError } = await supabase
      .from('vendor_pricing_history')
      .select('id, vendor_id, price_per_kg, effective_from, effective_until, created_by')
      .eq('vendor_id', vendorId)
      .order('effective_from', { ascending: false })
      .limit(20);

    if (historyError) {
      console.warn('[admin/gas-vendors/:id] pricing history error', historyError);
    }

    const { data: plants, error: plantsError } = await supabase
      .from('vendor_plants')
      .select('id, vendor_id, address, address_line, city, state, capacity_kg, ownership_type, lease_document_url, status, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (plantsError) {
      console.warn('[admin/gas-vendors/:id] vendor plants error', plantsError);
    }

    return NextResponse.json({
      ok: true,
      vendor,
      profile,
      currentPrice: currentPriceRow ?? null,
      priceHistory: priceHistory ?? [],
      plants: plants ?? [],
    });
  } catch (error: any) {
    console.error('[admin/gas-vendors/:id][GET]', error);
    return handleApiError(error, 'Failed to load vendor detail');
  }
}
