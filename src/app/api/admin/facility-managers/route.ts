import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.from('fm_profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const normalized = (data ?? []).map((fm: any) => {
      const fullName = typeof fm?.full_name === 'string' ? fm.full_name : typeof fm?.name === 'string' ? fm.name : null;
      const phone =
        typeof fm?.phone === 'string'
          ? fm.phone
          : typeof fm?.phone_number === 'string'
            ? fm.phone_number
            : null;

      return {
        ...fm,
        full_name: fullName,
        phone,
      };
    });

    return NextResponse.json({ ok: true, fms: normalized });
  } catch (error: any) {
    console.error('[admin/facility-managers][GET]', error);
    return handleApiError(error, 'Failed to load facility managers');
  }
}
