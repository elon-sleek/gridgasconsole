import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const fmId = url.searchParams.get('fmId');
  const tenantId = url.searchParams.get('tenantId');
  const buildingId = url.searchParams.get('buildingId');

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase
      .from('asset_assignments')
      .select(
        `
        id,
        asset_id,
        assigned_at,
        status,
        assigned_to_fm_id,
        assigned_to_tenant_id,
        building_id,
        assets (
          id,
          type,
          serial,
          meter_id,
          capacity_kg,
          building_id,
          install_address,
          created_at
        )
      `.trim()
      )
      .order('assigned_at', { ascending: false });

    if (fmId) query = query.eq('assigned_to_fm_id', fmId);
    if (tenantId) query = query.eq('assigned_to_tenant_id', tenantId);
    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, assignments: data ?? [] });
  } catch (error: any) {
    console.error('[admin/asset-assignments][GET]', error);
    return handleApiError(error, 'Failed to load asset assignments');
  }
}
