import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // super_admin only
    const { data: currentRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (currentRole?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);

    // Find old closed/resolved tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('support_tickets')
      .select('id')
      .in('status', ['closed', 'resolved'])
      .lte('updated_at', cutoff.toISOString())
      .limit(5000);

    if (ticketsError) throw ticketsError;

    const ids = (tickets ?? []).map((t: any) => t.id).filter(Boolean);
    let deletedCount = 0;

    // Delete in chunks to avoid URL/body limits
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error: deleteError } = await supabase
        .from('support_tickets')
        .delete()
        .in('id', chunk);

      if (deleteError) throw deleteError;
      deletedCount += chunk.length;
    }

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'support_cleanup_old_closed',
      entityType: 'support_tickets',
      entityId: null,
      oldValue: null,
      newValue: { deleted_count: deletedCount },
      metadata: { cutoff: cutoff.toISOString() },
    });

    return NextResponse.json({ success: true, deleted_count: deletedCount, cutoff: cutoff.toISOString() });
  } catch (error: any) {
    console.error('[support-cleanup]', error);
    return handleApiError(error, 'Failed to cleanup support tickets');
  }
}
