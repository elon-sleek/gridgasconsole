'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabaseClient';
import { useSessionStore } from '@/lib/sessionStore';
import {
  IconDashboard,
  IconAssets,
  IconFacilityManagers,
  IconCustomers,
  IconBuildings,
  IconVendors,
  IconPriceSettings,
  IconVend,
  IconSupport,
  IconSettings,
  IconAccount,
  IconInfo,
  IconList,
  IconPen,
  IconPalette,
  IconTruck
} from '@/components/AppIcons';

const navItems = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/assets', label: 'Assets', Icon: IconAssets },
  { href: '/facility-managers', label: 'Facility Managers', Icon: IconFacilityManagers },
  { href: '/customers', label: 'Customers/Tenants', Icon: IconCustomers },
  { href: '/buildings', label: 'Buildings', Icon: IconBuildings },
  { href: '/gas-vendors', label: 'Gas Vendors', Icon: IconVendors },
  { href: '/deliveries', label: 'Deliveries', Icon: IconTruck },
  { href: '/price-settings', label: 'Price Settings', Icon: IconPriceSettings },
  { href: '/vend', label: 'Vend', Icon: IconVend },
  { href: '/support', label: 'Support Center', Icon: IconSupport },
  { href: '/activity-logs', label: 'Activity Logs', Icon: IconList },
  { href: '/settings', label: 'General Settings', Icon: IconSettings }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const [settingsMenuPos, setSettingsMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const inSettings = pathname.startsWith('/settings');
  const supabase = createClient();
  const accessToken = useSessionStore((s) => s.session?.access_token ?? null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const settingsSubItems = useMemo(
    () => [
      { href: '/settings/profile', label: 'My Profile', Icon: IconAccount },
      { href: '/settings/preferences', label: 'Preferences', Icon: IconSettings },
      { href: '/settings/appearance', label: 'Appearance', Icon: IconPalette },
      { href: '/settings/audit-logs', label: 'Audit Logs', Icon: IconPen },
      ...(isSuperAdmin
        ? [{ href: '/settings/admins', label: 'Admin Users', Icon: IconCustomers }]
        : []),
      { href: '/settings/about', label: 'About', Icon: IconInfo },
    ],
    [isSuperAdmin]
  );

  // Prefetch main routes so sidebar taps feel instant.
  useEffect(() => {
    try {
      for (const item of navItems) {
        router.prefetch(item.href as any);
      }
      for (const sub of settingsSubItems) {
        router.prefetch(sub.href as any);
      }
    } catch {
      // ignore
    }
  }, [router, settingsSubItems]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('admin_portal_appearance');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return !!parsed?.sidebar_collapsed;
      } catch {
        return false;
      }
    };

    setCollapsed(read());

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin_portal_appearance') setCollapsed(read());
    };

    const onCustom = () => setCollapsed(read());

    window.addEventListener('storage', onStorage);
    window.addEventListener('admin_portal_appearance_changed' as any, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('admin_portal_appearance_changed' as any, onCustom);
    };
  }, []);

  const cancelSettingsCloseTimer = () => {
    if (settingsCloseTimerRef.current) {
      clearTimeout(settingsCloseTimerRef.current);
      settingsCloseTimerRef.current = null;
    }
  };

  const updateSettingsMenuPos = useCallback(() => {
    const btn = settingsButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const gap = 8;
    const menuWidth = 260;

    // Best-effort height measurement (if already rendered) with a safe fallback.
    const measuredHeight = settingsMenuRef.current?.getBoundingClientRect().height;
    const estimatedMenuHeight = Math.max(measuredHeight ?? 0, 64 + settingsSubItems.length * 40);

    const wouldClipBelow = rect.bottom + gap + estimatedMenuHeight > window.innerHeight - gap;
    const openRight = collapsed || wouldClipBelow;

    const desiredLeft = openRight ? rect.right + gap : rect.left;
    const maxLeft = Math.max(gap, window.innerWidth - menuWidth - gap);
    const left = Math.min(Math.max(gap, desiredLeft), maxLeft);

    const desiredTop = openRight ? rect.top : rect.bottom + gap;
    const maxTop = Math.max(gap, window.innerHeight - estimatedMenuHeight - gap);
    const top = Math.min(Math.max(gap, desiredTop), maxTop);

    setSettingsMenuPos({ top, left });
  }, [collapsed, settingsSubItems.length]);

  const openSettingsMenu = () => {
    cancelSettingsCloseTimer();
    setSettingsOpen(true);
    updateSettingsMenuPos();
  };

  const scheduleCloseSettingsMenu = () => {
    cancelSettingsCloseTimer();
    settingsCloseTimerRef.current = setTimeout(() => {
      setSettingsOpen(false);
      settingsCloseTimerRef.current = null;
    }, 350);
  };

  useEffect(() => {
    if (!inSettings) setSettingsOpen(false);
  }, [inSettings]);

  useEffect(() => {
    if (!settingsOpen) return;
    updateSettingsMenuPos();

    const onResize = () => updateSettingsMenuPos();
    const onScroll = () => updateSettingsMenuPos();

    window.addEventListener('resize', onResize);
    // capture=true so we also catch scroll inside the sidebar nav
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [settingsOpen, updateSettingsMenuPos]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const btn = settingsButtonRef.current;
      const menu = settingsMenuRef.current;
      if (btn?.contains(target) || menu?.contains(target)) return;
      setSettingsOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    return () => {
      cancelSettingsCloseTimer();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      try {
        const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? null;
        if (!token) {
          if (!cancelled) setIsSuperAdmin(false);
          return;
        }
        const res = await fetch('/api/admin/me/role', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          if (!cancelled) setIsSuperAdmin(false);
          return;
        }
        const text = await res.text();
        const json = text ? (JSON.parse(text) as { role?: unknown }) : {};
        if (!cancelled) setIsSuperAdmin(json.role === 'super_admin');
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      }
    }
    loadRole();
    return () => {
      cancelled = true;
    };
  }, [accessToken, supabase]);

  return (
    <aside
      className={classNames(
        'shrink-0 border-r border-border dark:border-dark-border bg-surface dark:bg-dark-surface h-screen sticky top-0 flex flex-col relative z-50',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="px-4 py-4 border-b border-border dark:border-dark-border">
        <Link href="/" className="flex items-center gap-3" aria-label="Go to dashboard">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden bg-white border-2 border-cyan-500">
            <img src="/assets/Gridgas_logo.png" alt="GridGas Logo" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">GridGas Board</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary truncate">Administrative Portal</p>
            </div>
          )}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map((item) => {
          if (item.href === '/settings') {
            const active = inSettings;
            const Icon = item.Icon;
            const open = settingsOpen;

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={openSettingsMenu}
                onMouseLeave={scheduleCloseSettingsMenu}
              >
                <button
                  type="button"
                  ref={settingsButtonRef}
                  onClick={() => {
                    cancelSettingsCloseTimer();
                    setSettingsOpen((v) => !v);
                    if (!inSettings) router.push('/settings');
                  }}
                  className={classNames(
                    'w-full flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-white'
                      : 'text-textSecondary dark:text-dark-textSecondary hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted hover:text-textPrimary dark:hover:text-dark-textPrimary'
                  )}
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  <Icon className={classNames('h-4 w-4', active ? 'text-white' : 'text-primary')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </div>
            );
          }

          const active = pathname === item.href;
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={classNames(
                'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-white'
                  : 'text-textSecondary dark:text-dark-textSecondary hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted hover:text-textPrimary dark:hover:text-dark-textPrimary'
              )}
            >
              <Icon className={classNames('h-4 w-4', active ? 'text-white' : 'text-primary')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {isMounted && settingsOpen && settingsMenuPos
          ? createPortal(
              <div
                ref={settingsMenuRef}
                className="fixed card p-2 z-[1000] w-[260px]"
                style={{ top: settingsMenuPos.top, left: settingsMenuPos.left }}
                role="menu"
                onMouseEnter={cancelSettingsCloseTimer}
                onMouseLeave={scheduleCloseSettingsMenu}
              >
                <div className="px-2 py-1 text-xs font-semibold text-textSecondary dark:text-dark-textSecondary">
                  General Settings
                </div>
                <div className="h-px bg-border dark:bg-dark-border my-2" />
                <div className="space-y-1">
                  {settingsSubItems.map((sub) => {
                    const SubIcon = sub.Icon;
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href as any}
                        onClick={() => setSettingsOpen(false)}
                        className={classNames(
                          'flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
                          subActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted'
                        )}
                        role="menuitem"
                      >
                        <SubIcon className="h-4 w-4 text-primary" />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>,
              document.body
            )
          : null}
      </nav>
    </aside>
  );
}
