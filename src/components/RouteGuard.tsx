'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/sessionStore';
import { getUserRole, hasPermission, isRole, type Role } from '@/lib/roles';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { getAccessToken } from '@/lib/sessionStore';

type RouteGuardProps = {
  children: React.ReactNode;
  requiredRole?: Role;
  requiredPermission?: string;
  fallbackUrl?: string;
};

export function RouteGuard({ children, requiredRole, requiredPermission, fallbackUrl = '/login' }: RouteGuardProps) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const storedRole = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);

  const [resolvedRole, setResolvedRole] = useState<Role | null>(storedRole ?? null);
  const [resolving, setResolving] = useState<boolean>(!storedRole);
  const redirectOnceRef = useRef(false);

  const authorized = useMemo(() => {
    if (!user) return false;
    if (!resolvedRole) return false;
    if (requiredRole && resolvedRole !== requiredRole) return false;
    if (requiredPermission && !hasPermission(resolvedRole, requiredPermission)) return false;
    return true;
  }, [user, resolvedRole, requiredRole, requiredPermission]);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!user) {
        if (!redirectOnceRef.current) {
          redirectOnceRef.current = true;
          router.push(fallbackUrl as any);
        }
        return;
      }

      // If we already resolved a role for this session, keep navigation instant.
      if (storedRole) {
        setResolvedRole(storedRole);
        setResolving(false);
        return;
      }

      setResolving(true);
      setResolvedRole(null);

      const metaRole = getUserRole(user);
      let role: Role | null = metaRole;

      if (!role) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('admin_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!error && (data?.role === 'super_admin' || data?.role === 'admin' || data?.role === 'support' || data?.role === 'fm_viewer')) {
          role = data.role;
        }
      }

      // If client-side RLS blocks reading admin_roles, fall back to a server-side role resolver.
      // This uses the current access token and service-role lookup server-side.
      if (!role) {
        const token = getAccessToken();
        if (token) {
          try {
            const res = await fetch('/api/admin/me/role', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const text = await res.text();
              if (text) {
                const json = JSON.parse(text) as { role?: unknown };
                if (isRole(json.role)) role = json.role;
              }
            }
          } catch {
            // ignore; we'll treat as unauthorized below
          }
        }
      }

      if (cancelled) return;

      setResolvedRole(role);
      setRole(role);
      setResolving(false);

      if (!role) {
        if (!redirectOnceRef.current) {
          redirectOnceRef.current = true;
          router.push('/unauthorized' as any);
        }
        return;
      }

      if (requiredRole && role !== requiredRole) {
        if (!redirectOnceRef.current) {
          redirectOnceRef.current = true;
          router.push('/unauthorized' as any);
        }
        return;
      }

      if (requiredPermission && !hasPermission(role, requiredPermission)) {
        if (!redirectOnceRef.current) {
          redirectOnceRef.current = true;
          router.push('/unauthorized' as any);
        }
        return;
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [user, requiredRole, requiredPermission, router, fallbackUrl, storedRole, setRole]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
            {user ? (resolving ? 'Please wait a sec...' : 'Checking access...') : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
