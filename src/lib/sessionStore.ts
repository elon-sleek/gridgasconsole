'use client';

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Role } from './roles';

export type SessionState = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loginAt: number | null;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  role: null,
  loginAt: null,
  setSession: (session) =>
    set((state) => {
      const nextUser = session?.user ?? null;
      const prevUserId = state.user?.id ?? null;
      const nextUserId = nextUser?.id ?? null;

      // Prefer a stable login timestamp from Supabase when available.
      // This avoids resetting the timer on token refreshes or app focus.
      const lastSignInAt =
        typeof (nextUser as any)?.last_sign_in_at === 'string'
          ? Date.parse((nextUser as any).last_sign_in_at)
          : NaN;
      const stableLoginAt = Number.isFinite(lastSignInAt) ? lastSignInAt : null;

      const userChanged = prevUserId && nextUserId && prevUserId !== nextUserId;

      // Reset loginAt when:
      // - first time we see a session
      // - the user changes
      // - Supabase reports a newer last_sign_in_at (actual re-login)
      const isRelogin =
        stableLoginAt != null &&
        (state.loginAt == null || stableLoginAt > state.loginAt + 1_000);

      const loginAt = session
        ? stableLoginAt != null
          ? // Always trust Supabase's sign-in timestamp; it changes on real logins.
            (userChanged || isRelogin || state.loginAt == null ? stableLoginAt : state.loginAt)
          : // Fallback if Supabase didn't provide a sign-in time.
            (state.loginAt == null || userChanged ? Date.now() : state.loginAt)
        : null;

      return {
        session,
        user: nextUser,
        role: session ? state.role : null,
        loginAt,
      };
    }),
  setRole: (role) => set({ role }),
  clearSession: () => set({ session: null, user: null, role: null, loginAt: null })
}));

export function getAccessToken(): string | null {
  const state = useSessionStore.getState();
  return state.session?.access_token ?? null;
}
