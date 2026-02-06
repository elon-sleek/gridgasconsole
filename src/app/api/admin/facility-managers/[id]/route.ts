import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: fmId } = await ctx.params;
  if (!fmId) return NextResponse.json({ error: 'FM id is required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.from('fm_profiles').select('*').eq('id', fmId).single();
    if (error) throw error;

    const fullName =
      typeof (data as any)?.full_name === 'string'
        ? (data as any).full_name
        : typeof (data as any)?.name === 'string'
          ? (data as any).name
          : null;

    const phone =
      typeof (data as any)?.phone === 'string'
        ? (data as any).phone
        : typeof (data as any)?.phone_number === 'string'
          ? (data as any).phone_number
          : null;

    return NextResponse.json({ ok: true, fm: { ...data, full_name: fullName, phone } });
  } catch (error: any) {
    console.error('[admin/facility-managers/:id][GET]', error);
    return handleApiError(error, 'Failed to load facility manager');
  }
}
