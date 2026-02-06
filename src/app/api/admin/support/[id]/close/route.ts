import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';

/**
 * POST /api/admin/support/[id]/close
 * 
 * Close a support ticket with resolution notes.
 * 
 * Body:
 * - resolution: string (optional resolution notes)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;
    const body = await req.json();
    const { resolution } = body;

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await adminClient
      .from('support_tickets')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        resolution: resolution || 'Closed by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Close failed:', error);
      return NextResponse.json({ error: 'Failed to close ticket' }, { status: 500 });
    }

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'support_close',
      entityType: 'support_tickets',
      entityId: ticketId,
      oldValue: null,
      newValue: { status: 'closed', resolution: resolution || 'Closed by admin' }
    });

    return NextResponse.json({ success: true, ticket: data });
  } catch (error: any) {
    console.error('Close error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
