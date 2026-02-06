'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';

/**
 * Client-side Supabase helper.
 * Kept for compatibility with pages/components that import `@/lib/supabase/client`.
 */
export function createClient(): SupabaseClient {
  return getSupabaseClient();
}
