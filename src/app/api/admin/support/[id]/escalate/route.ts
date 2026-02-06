import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';

/**
 * POST /api/admin/support/[id]/escalate
 * 
 * Escalate a support ticket to admin attention.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await adminClient
      .from('support_tickets')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        escalation_reason: 'MANUAL_ADMIN_ESCALATION',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Escalation failed:', error);
      return NextResponse.json({ error: 'Failed to escalate ticket' }, { status: 500 });
    }

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'support_escalate',
      entityType: 'support_tickets',
      entityId: ticketId,
      oldValue: null,
      newValue: { status: 'escalated', escalation_reason: 'MANUAL_ADMIN_ESCALATION' }
    });

    return NextResponse.json({ success: true, ticket: data });
  } catch (error: any) {
    console.error('Escalate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
