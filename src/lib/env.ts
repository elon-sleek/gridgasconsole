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

/** Lazily resolved so the module can be imported at build time without throwing. */
let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    _env = {
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
  }
  return _env;
}

/**
 * Keep the original export for backward compat.
 * Accessing any property triggers the lazy init via a Proxy,
 * so importing the module at build time no longer throws.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  }
});
