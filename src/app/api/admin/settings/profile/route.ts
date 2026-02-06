import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/auth';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { handleApiError } from '@/lib/errorHandling';

/**
 * POST /api/admin/settings/profile
 * 
 * Update current admin user's profile preferences (notifications, timezone, etc.)
 * 
 * Body:
 * - timezone: string
 * - notifications: { email_tickets, sms_escalated, desktop_notifications }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { timezone, notifications } = body;

    const adminClient = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Get existing preferences
    const { data: existing } = await adminClient
      .from('admin_user_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    // Merge with new preferences
    const updatedPreferences = {
      ...(existing?.preferences || {}),
      timezone,
      notifications,
      updated_at: new Date().toISOString(),
    };

    // Upsert preferences
    const { data, error } = await adminClient
      .from('admin_user_preferences')
      .upsert(
        {
          user_id: user.id,
          preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to update preferences:', error);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    await insertAdminAuditLog({
      req,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_profile_preferences',
      entityType: 'admin_user_preferences',
      entityId: user.id,
      oldValue: (existing?.preferences as any) ?? null,
      newValue: (updatedPreferences as any) ?? null
    });

    return NextResponse.json({ success: true, preferences: data });
  } catch (error: any) {
    console.error('[settings-profile]', error);
    return handleApiError(error, 'Failed to update profile preferences');
  }
}
