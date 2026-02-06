export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  thingsboardBaseUrl?: string;
  mapApiKey?: string;
};

function required(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value || undefined;
}

export const env: Env = {
  supabaseUrl: required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_URL'
  ),
  supabaseAnonKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ),
  thingsboardBaseUrl: optional(process.env.NEXT_PUBLIC_TB_BASE_URL),
  mapApiKey: optional(process.env.NEXT_PUBLIC_MAP_API_KEY)
};
