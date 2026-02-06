import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errorHandling';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const adminEmail = searchParams.get('admin_email');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch audit logs
    let query = supabase
      .from('admin_audit_log')
      .select(`
        id,
        user_email,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        metadata,
        ip_address,
        created_at
      `)
      .order('created_at', { ascending: false });

    // Filter by action
    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (entityType && entityType !== 'all') {
      query = query.eq('entity_type', entityType);
    }

    if (adminEmail && adminEmail !== 'all') {
      query = query.eq('user_email', adminEmail);
    }

    // Filter by date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    query = query.gte('created_at', startDate.toISOString());

    const { data, error } = await query;

    if (error) throw error;

    const logs = (data ?? []) as any[];

    const headers = [
      'Timestamp',
      'Admin Email',
      'Action',
      'Entity Type',
      'Entity ID',
      'Old Value',
      'New Value',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.user_email || 'Unknown',
      log.action,
      log.entity_type,
      log.entity_id,
      JSON.stringify(log.old_value || ''),
      JSON.stringify(log.new_value || ''),
      log.ip_address || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('[audit-export]', error);
    return handleApiError(error, 'Failed to export audit logs');
  }
}
