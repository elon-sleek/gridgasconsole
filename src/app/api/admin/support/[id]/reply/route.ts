import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';

/**
 * POST /api/admin/support/[id]/reply
 * 
 * Add an admin reply to a support ticket.
 * 
 * Body:
 * - message: string
 * - isInternal: boolean (whether this is a staff-only internal note)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;
    const body = await req.json();
    const { message, isInternal } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Insert message
    const { data, error } = await adminClient
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'admin',
        message: message.trim(),
        is_internal: isInternal || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert message:', error);
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
    }

    // Update ticket updated_at timestamp
    await adminClient
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'support_reply',
      entityType: 'support_tickets',
      entityId: ticketId,
      oldValue: null,
      newValue: {
        message_preview: message.trim().slice(0, 200),
        is_internal: !!isInternal
      },
      metadata: { message_length: message.trim().length }
    });

    return NextResponse.json({ success: true, message: data });
  } catch (error: any) {
    console.error('Reply error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
