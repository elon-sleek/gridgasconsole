'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSessionStore } from '@/lib/sessionStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);
  const user = useSessionStore((s) => s.user);
  const [loading, setLoading] = useState(true);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const supabase = getSupabaseClient();
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

    const reset = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          router.replace('/login');
          router.refresh();
        }
      }, IDLE_TIMEOUT_MS);
    };

    reset();

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
    ];

    for (const ev of events) window.addEventListener(ev, reset, { passive: true } as any);

    return () => {
      for (const ev of events) window.removeEventListener(ev, reset as any);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [user, router]);

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
