import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';
import { insertAdminAuditLog } from '@/lib/adminAudit';

function toNumberOrNull(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: buildingId } = await ctx.params;
  if (!buildingId) return NextResponse.json({ error: 'Building id is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.from('buildings').select('*').eq('id', buildingId).single();
    if (error) throw error;

    const latitude = toNumberOrNull((data as any)?.latitude) ?? toNumberOrNull((data as any)?.lat);
    const longitude =
      toNumberOrNull((data as any)?.longitude) ??
      toNumberOrNull((data as any)?.lng) ??
      toNumberOrNull((data as any)?.long) ??
      toNumberOrNull((data as any)?.lon);

    return NextResponse.json({
      ok: true,
      building: {
        ...data,
        latitude,
        longitude,
      },
    });
  } catch (error: any) {
    console.error('[admin/buildings/:id][GET]', error);
    return handleApiError(error, 'Failed to load building');
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: buildingId } = await ctx.params;
  if (!buildingId) return NextResponse.json({ error: 'Building id is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: existing, error: readErr } = await supabase.from('buildings').select('*').eq('id', buildingId).maybeSingle();
    if (readErr) throw readErr;
    if (!existing) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

    const { error: delErr } = await supabase.from('buildings').delete().eq('id', buildingId);
    if (delErr) throw delErr;

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'deleted_building',
      entityType: 'building',
      entityId: buildingId,
      oldValue: existing,
      newValue: null,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[admin/buildings/:id][DELETE]', error);
    return handleApiError(error, 'Failed to delete building');
  }
}
