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
    const body = await request.json();

    const { theme, sidebar_collapsed } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing preferences
    const { data: existing } = await supabase
      .from('admin_user_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    const oldPreferences = existing?.preferences || {};
    const newPreferences = {
      ...oldPreferences,
      theme,
      sidebar_collapsed,
    };

    // Upsert preferences
    const { error } = await supabase
      .from('admin_user_preferences')
      .upsert({
        user_id: user.id,
        preferences: newPreferences,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'updated_appearance',
      entityType: 'admin_user_preferences',
      entityId: user.id,
      oldValue: oldPreferences,
      newValue: newPreferences,
      metadata: { section: 'appearance' }
    });

    return NextResponse.json({
      success: true,
      preferences: newPreferences,
    });
  } catch (error: any) {
    console.error('[settings-appearance]', error);
    return handleApiError(error, 'Failed to update appearance');
  }
}
