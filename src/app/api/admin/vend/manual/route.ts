import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

/**
 * POST /api/admin/vend/manual
 * 
 * Manually trigger a gas vend for a specific meter.
 * This creates a gas_purchases record, generates a token, and sends the vend command.
 * 
 * Body:
 * - meterId: string (UUID of the meter)
 * - amountNaira: number (purchase amount in NGN)
 * - note: string (optional admin note)
 * 
 * Process:
 * 1. Create gas_purchases record (source: admin_manual)
 * 2. Call vendor-vend-token Edge Function (generate token)
 * 3. Call tb-send-vend Edge Function (send to ThingsBoard)
 * 4. Return result
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { meterId, amountNaira, note } = body;

    if (!meterId || typeof meterId !== 'string') {
      return NextResponse.json({ error: 'meterId is required' }, { status: 400 });
    }

    const amount = typeof amountNaira === 'number' ? amountNaira : Number(amountNaira);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      return NextResponse.json({ error: 'Valid amountNaira is required' }, { status: 400 });
    }

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Get meter details
    const { data: meter, error: meterError } = await adminClient
      .from('meters')
      .select(`
        id,
        meter_number,
        tenant_id,
        building_id,
        status,
        tenant:tenant_profiles!tenant_id(id, user_id, full_name)
      `)
      .eq('id', meterId)
      .single();

    if (meterError || !meter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    if (!meter.tenant_id || !meter.tenant) {
      return NextResponse.json({ error: 'Meter has no assigned tenant' }, { status: 400 });
    }

    if (meter.status === 'locked') {
      return NextResponse.json({ error: 'Meter is locked' }, { status: 400 });
    }

    const tenantUserId = (meter.tenant as any).user_id;

    // Get current tariff rate
    let ratePerKg = 1500; // default fallback
    
    // Check for building override
    const { data: buildingOverride } = await adminClient
      .from('building_tariff_overrides')
      .select('price_per_kg')
      .eq('building_id', meter.building_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (buildingOverride) {
      ratePerKg = buildingOverride.price_per_kg;
    } else {
      // Check global rate
      const { data: globalRate } = await adminClient
        .from('tariff_settings')
        .select('price_per_kg')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (globalRate) {
        ratePerKg = globalRate.price_per_kg;
      }
    }

    if (!Number.isFinite(ratePerKg) || ratePerKg <= 0) {
      return NextResponse.json({ error: 'Tariff rate is invalid' }, { status: 500 });
    }

    const kg = Math.round((amount / ratePerKg) * 1000) / 1000; // 3 decimal places

    if (!Number.isFinite(kg) || kg < 1 || kg > 100) {
      return NextResponse.json({ error: 'Calculated kg is invalid' }, { status: 400 });
    }

    // Create purchase record (service-role for admin override)
    const { data: purchase, error: purchaseError } = await adminClient
      .from('gas_purchases')
      .insert({
        tenant_id: meter.tenant_id,
        meter_id: meter.id,
        building_id: meter.building_id,
        kg,
        amount_naira: amount,
        rate_per_kg: ratePerKg,
        currency: 'NGN',
        status: 'token_pending',
        idempotency_key: `admin_manual:${user.id}:${Date.now()}`,
        metadata: {
          source: 'admin_manual',
          admin_user_id: user.id,
          admin_note: note || null,
        },
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase creation failed:', purchaseError);
      return NextResponse.json(
        { error: 'Failed to create purchase record', details: purchaseError?.message },
        { status: 500 }
      );
    }

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'vended_gas',
      entityType: 'gas_purchases',
      entityId: purchase.id,
      oldValue: null,
      newValue: {
        purchase_id: purchase.id,
        meter_id: meter.id,
        tenant_id: meter.tenant_id,
        building_id: meter.building_id,
        kg,
        amount_naira: amount,
        rate_per_kg: ratePerKg,
        note: note || null
      },
      metadata: { source: 'admin_manual' }
    });

    // Call vendor-vend-token Edge Function
    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vendor-vend-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          purchase_id: purchase.id,
          meter_id: meter.id,
          kg,
        }),
      }
    );

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error('Token generation failed:', tokenErr);
      console.error('[token-generation]', tokenErr);
      return NextResponse.json(
        { error: 'Token generation failed' },
        { status: 500 }
      );
    }

    const tokenResult = await tokenRes.json();

    // Call tb-send-vend Edge Function
    const sendRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tb-send-vend`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          meter_id: meter.id,
          purchase_id: purchase.id,
          vend_token: tokenResult.token || tokenResult.vend_token,
          kg,
        }),
      }
    );

    if (!sendRes.ok) {
      const sendErr = await sendRes.text();
      console.error('[send-vend]', sendErr);
      return NextResponse.json(
        { error: 'Send vend command failed' },
        { status: 500 }
      );
    }

    const sendResult = await sendRes.json();

    return NextResponse.json({
      success: true,
      purchase,
      token: tokenResult.token || tokenResult.vend_token,
      sent: sendResult,
      message: `Vend initiated: ${kg}kg (₦${amount}) to meter ${meter.meter_number}`,
    });
  } catch (error: any) {
    console.error('[manual-vend]', error);
    return handleApiError(error, 'Failed to process manual vend');
  }
}
