import { createClient } from '@supabase/supabase-js';
import { env } from './env';

function requiredServerEnv(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Missing required server env: ${key}`);
  return value;
}

export function getSupabaseAdminClient() {
  // Never expose this key to the browser.
  const serviceRoleKey = requiredServerEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');

  return createClient(env.supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function requireAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
