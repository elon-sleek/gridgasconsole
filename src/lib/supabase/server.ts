import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '../env';

export function createClient(serviceRoleKey: string) {
  return createSupabaseClient(env.supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
