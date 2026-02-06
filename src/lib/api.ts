import { getSupabaseClient } from './supabaseClient';
import { getAccessToken } from './sessionStore';

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = getSupabaseClient();
  let token = getAccessToken();

  if (!token) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers
  });
}
