'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSessionStore } from '@/lib/sessionStore';

export function LoginForm({ redirectTo = '/dashboard' }: { redirectTo?: '/' | '/login' | '/dashboard' }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const setSession = useSessionStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSession(data.session ?? null);
    const destination = redirectTo === '/' ? '/dashboard' : redirectTo;
    router.replace(destination);
    router.refresh();
  }

  return (
    <main
      className="min-h-screen w-full bg-black bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assets/admin-login-bg.png')" }}
    >
      <div className="min-h-screen w-full bg-black/20 flex items-center justify-end px-4 sm:px-8 md:px-12 lg:px-16 py-8">
        <div className="w-full max-w-md bg-transparent p-6 sm:p-8">
          <p className="text-white text-lg sm:text-xl font-medium mb-6">sign in with your credentials</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-control border border-white/90 bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/70 outline-none focus:border-white focus:ring-2 focus:ring-white/25"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white">Password</label>
              <input
                type="password"
                required
                className="w-full rounded-control border border-white/90 bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/70 outline-none focus:border-white focus:ring-2 focus:ring-white/25"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-control bg-[#FFC259] text-black py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
