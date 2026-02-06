import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';

/**
 * POST /api/admin/support/[id]/reassign
 * 
 * Reassign a support ticket to a different FM.
 * 
 * Body:
 * - fmId: string (UUID of the new FM)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;
    const body = await req.json();
    const { fmId } = body;

    if (!fmId || typeof fmId !== 'string') {
      return NextResponse.json({ error: 'fmId is required' }, { status: 400 });
    }

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await adminClient
      .from('support_tickets')
      .update({
        fm_id: fmId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Reassign failed:', error);
      return NextResponse.json({ error: 'Failed to reassign ticket' }, { status: 500 });
    }

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'support_reassign',
      entityType: 'support_tickets',
      entityId: ticketId,
      oldValue: null,
      newValue: { fm_id: fmId }
    });

    return NextResponse.json({ success: true, ticket: data });
  } catch (error: any) {
    console.error('Reassign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
