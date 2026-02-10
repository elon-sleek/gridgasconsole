'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSessionStore } from '@/lib/sessionStore';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { IconAccount } from '@/components/AppIcons';

/** Format milliseconds elapsed into "Xh Ym Zs" */
function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function Topbar() {
  const user = useSessionStore((s) => s.user);
  const loginAt = useSessionStore((s) => s.loginAt);
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  // Tick every second to keep the elapsed counter live
  useEffect(() => {
    if (!loginAt) return;
    const tick = () => setElapsed(fmtElapsed(Date.now() - loginAt));
    tick();
    const id = setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loginAt]);

  // Fixed login timestamp string (never changes once set)
  const loginTimeStr = useMemo(
    () => (loginAt ? new Date(loginAt).toLocaleString() : ''),
    [loginAt],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 shrink-0 sticky top-0 z-40 border-b border-border dark:border-dark-border bg-surface dark:bg-dark-surface flex items-center justify-between px-4">
      {/* User info (replaces branding spot) */}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{user?.email || 'Admin'}</div>
        <div className="text-xs text-textSecondary dark:text-dark-textSecondary truncate">
          {loginTimeStr ? `Logged in: ${loginTimeStr} · ${elapsed}` : '—'}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-primary relative">
        <Link
          href="/settings/profile"
          className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"
          aria-label="My Profile"
        >
          {typeof (user as any)?.user_metadata?.avatar_url === 'string' && (user as any).user_metadata.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(user as any).user_metadata.avatar_url}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <IconAccount className="h-5 w-5 text-primary" />
          )}
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted rounded-control"
            aria-label="Account menu"
          >
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 card py-1 shadow-lg z-50">
              <Link
                href="/settings/profile"
                className="block px-4 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
                onClick={() => setMenuOpen(false)}
              >
                My Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
