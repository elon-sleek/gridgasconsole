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
    set((state) => ({
      session,
      user: session?.user ?? null,
      role: session ? state.role : null,
      loginAt: session ? Date.now() : null,
    })),
  setRole: (role) => set({ role }),
  clearSession: () => set({ session: null, user: null, role: null, loginAt: null })
}));

export function getAccessToken(): string | null {
  const state = useSessionStore.getState();
  return state.session?.access_token ?? null;
}
