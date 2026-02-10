export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  thingsboardBaseUrl?: string;
  mapApiKey?: string;
};

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` as string literals at BUILD time.
 * The values MUST appear as direct `process.env.NEXT_PUBLIC_X` expressions
 * (no indirection, no variables, no Proxy) for the compiler to replace them.
 *
 * We read them directly here so the build can inline them into the client bundle.
 * Server-only env vars (without NEXT_PUBLIC_) are only read at runtime.
 */
export const env: Env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  thingsboardBaseUrl: process.env.NEXT_PUBLIC_TB_BASE_URL || undefined,
  mapApiKey: process.env.NEXT_PUBLIC_MAP_API_KEY || undefined,
};
