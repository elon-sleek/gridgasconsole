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
    <main className="min-h-screen flex flex-col items-center justify-center bg-surfaceMuted dark:bg-dark-surfaceMuted px-4">
      <div className="w-full max-w-md card p-8 space-y-6">
        {/* GridGas Board Logo & Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden bg-white border-2 border-cyan-500">
              <img src="/assets/Gridgas_logo.png" alt="GridGas Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">GridGas Board</h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">by The Grid Gas Network</p>
          </div>
        </div>

        <div className="border-t border-border dark:border-dark-border pt-4">
          <h2 className="text-xl font-semibold">Admin Portal</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Sign in with your credentials</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-control bg-primary text-white py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-textSecondary dark:text-dark-textSecondary">
        <p>© 2024 The Grid Gas Network</p>
        <p className="mt-1">GridGas Board · Enterprise LPG Management Platform</p>
      </div>
    </main>
  );
}
