import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { insertAdminAuditLog } from '@/lib/adminAudit';

async function sendVendorApprovedEmail(params: { to: string; vendorName: string }) {
  const url = process.env.EMAIL_SERVICE_URL || '';
  const apiKey = process.env.EMAIL_SERVICE_KEY || '';
  if (!url || !apiKey) return;

  const fromEmail = process.env.EMAIL_FROM_VENDOR_APPROVAL || 'support@gridgas.network';
  const fromName = process.env.EMAIL_FROM_VENDOR_APPROVAL_NAME || 'GridGas';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: params.to,
      from: { email: fromEmail, name: fromName },
      subject: 'Vendor Account Approved',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <h2>Vendor Account Approved</h2>
          <p>Your vendor account (<strong>${params.vendorName}</strong>) has been approved and is now active.</p>
          <p>You can now proceed to use the vendor app features.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`vendor_approval_email_failed:${res.status}:${body}`);
  }
}

/**
 * POST /api/admin/gas-vendors/approve
 * 
 * Approves a pending vendor profile and sets plant coordinates.
 * Body: { vendorId: string, profileId: string, lat: number, lng: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { vendorId, profileId, lat, lng } = body;

    if (!vendorId || !profileId) {
      return NextResponse.json({ error: 'vendorId and profileId are required' }, { status: 400 });
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Valid lat and lng coordinates are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Fetch profile for email + audit context
    const { data: profile, error: profileLookupError } = await supabase
      .from('vendor_profiles')
      .select('id, email, full_name, vendor_id')
      .eq('id', profileId)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json({ error: profileLookupError.message }, { status: 500 });
    }

    // Update vendor profile status to approved
    const { error: profileError } = await supabase
      .from('vendor_profiles')
      .update({ status: 'approved' })
      .eq('id', profileId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Update gas_vendors with coordinates and verified_at
    const { error: vendorError } = await supabase
      .from('gas_vendors')
      .update({
        plant_lat: lat,
        plant_lng: lng,
        verified_at: new Date().toISOString(),
        active: true
      })
      .eq('id', vendorId);

    if (vendorError) {
      return NextResponse.json({ error: vendorError.message }, { status: 500 });
    }

    // Approve any pending plants for this vendor (covers re-approval after adding a branch)
    const { error: plantsApproveError } = await supabase
      .from('vendor_plants')
      .update({ status: 'approved' })
      .eq('vendor_id', vendorId)
      .eq('status', 'pending_approval');

    if (plantsApproveError) {
      console.warn('[approve-vendor] failed to approve vendor plants', plantsApproveError);
      // Do not block approval; admin can retry from vendor detail.
    }

    // Log the audit action
    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email },
      action: 'approve_vendor',
      entityType: 'vendor_profiles',
      entityId: profileId,
      metadata: { vendorId, lat, lng }
    });

    // Best-effort: send approval email (should not block approval)
    try {
      const to = (profile?.email ?? '').trim();
      if (to) {
        await sendVendorApprovedEmail({
          to,
          vendorName: String(vendorId),
        });
      }
    } catch (e) {
      console.warn('Vendor approval email failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error approving vendor:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
