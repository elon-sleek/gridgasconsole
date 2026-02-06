import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

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

function parseNonNegativeNumber(value: unknown, fieldLabel: string): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: 0 };

  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') n = Number(value.trim());
  else return { ok: false, error: `${fieldLabel} must be a number.` };

  if (!Number.isFinite(n)) return { ok: false, error: `${fieldLabel} must be a valid number.` };
  if (n < 0) return { ok: false, error: `${fieldLabel} must be 0 or greater.` };
  return { ok: true, value: n };
}

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { pricePerKg, upliftFirstNKgPerMonth, upliftAmountPerKg } = body ?? {};

  const parsed = parsePositivePricePerKg(pricePerKg);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const parsedUpliftN = parseNonNegativeNumber(upliftFirstNKgPerMonth, 'Uplift first N kg per month');
  if (!parsedUpliftN.ok) return NextResponse.json({ error: parsedUpliftN.error }, { status: 400 });

  const parsedUpliftAmt = parseNonNegativeNumber(upliftAmountPerKg, 'Uplift amount per kg');
  if (!parsedUpliftAmt.ok) return NextResponse.json({ error: parsedUpliftAmt.error }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: oldTariff } = await supabase
      .from('tariff_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    // Use direct upsert with service_role client (RLS bypassed).
    // This avoids needing the RPC function which may not be deployed yet.
    const { data, error } = await supabase
      .from('tariff_settings')
      .upsert({
        id: 1,
        global_rate_per_kg: parsed.value,
        uplift_first_n_kg_per_month: parsedUpliftN.value,
        uplift_amount_per_kg: parsedUpliftAmt.value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_tariff',
      entityType: 'tariff_settings',
      entityId: (data as any)?.id ?? null,
      oldValue: (oldTariff as any) ?? null,
      newValue: (data as any) ?? null,
      metadata: {
        scope: 'global',
        pricePerKg: parsed.value,
        upliftFirstNKgPerMonth: parsedUpliftN.value,
        upliftAmountPerKg: parsedUpliftAmt.value,
      }
    });

    return NextResponse.json({ 
      ok: true,
      tariff: data,
      message: 'Global tariff updated successfully'
    });

  } catch (error: any) {
    console.error('[global-price-settings]', error);
    return handleApiError(error, 'Failed to update global price');
  }
}

