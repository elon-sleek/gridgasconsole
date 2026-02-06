'use client';

import { ReactNode, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSessionStore } from '@/lib/sessionStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session);
      else clearSession();
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [setSession, clearSession]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-dark-surface">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
