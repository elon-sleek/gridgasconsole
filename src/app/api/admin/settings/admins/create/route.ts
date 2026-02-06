import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/auth-utils';
import bcrypt from 'bcrypt';
import { insertAdminAuditLog } from '@/lib/adminAudit';
import { randomBytes } from 'crypto';
import { handleApiError } from '@/lib/errorHandling';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing Supabase env vars' },
        { status: 500 }
      );
    }

    const user = await requireAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const { email, full_name, role, pin, password } = body;

    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedName = typeof full_name === 'string' ? full_name.trim() : '';
    const roleValue = typeof role === 'string' ? role : '';

    if (!trimmedEmail) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!trimmedName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    if (!roleValue) return NextResponse.json({ error: 'Role is required' }, { status: 400 });

    let effectivePassword: string | null = null;
    let generatedPassword: string | null = null;

    if (typeof password === 'string' && password.trim()) {
      if (password.trim().length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      effectivePassword = password.trim();
    } else {
      generatedPassword = randomBytes(12).toString('base64url');
      effectivePassword = generatedPassword;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if current user is super admin
    const { data: currentRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (currentRole?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create user via Supabase Admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password: effectivePassword,
      email_confirm: true,
      user_metadata: { full_name: trimmedName },
    });

    if (createError) throw createError;

    // Assign role
    const { error: roleError } = await supabase.from('admin_roles').insert({
      user_id: newUser.user.id,
      role: roleValue,
      assigned_by: user.id,
    });

    if (roleError) throw roleError;

    // Set PIN if provided
    if (pin) {
      const pinHash = await bcrypt.hash(pin, 10);
      const { error: pinError } = await supabase.from('admin_passworded_access').insert({
        user_id: newUser.user.id,
        pin_hash: pinHash,
        granted_by: user.id,
      });

      if (pinError) throw pinError;
    }

    await insertAdminAuditLog({
      req: request,
      actor: { id: user.id, email: user.email ?? null },
      action: 'created_admin',
      entityType: 'admin_user',
      entityId: newUser.user.id,
      oldValue: null,
      newValue: { email: trimmedEmail, role: roleValue, has_pin: !!pin },
      metadata: { email: trimmedEmail, role: roleValue }
    });

    return NextResponse.json({
      success: true,
      admin_id: newUser.user.id,
      temporary_password: generatedPassword,
    });
  } catch (error: any) {
    console.error('[create-admin]', error);
    return handleApiError(error, 'Failed to create admin user');
  }
}
