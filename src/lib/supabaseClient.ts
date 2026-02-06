import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  return browserClient;
}

// Backwards-compatible alias used by some pages/components.
export function createClient(): SupabaseClient {
  return getSupabaseClient();
}
