import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';
import { isRole, type Role } from '@/lib/roles';
import { handleApiError } from '@/lib/errorHandling';

export async function GET(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[me-role]', error);
    return handleApiError(error, 'Failed to fetch user role');
  }

  const role = (data?.role as Role | null) ?? null;
  return NextResponse.json({ role: isRole(role) ? role : null });
}
