'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatSupabaseError, isMissingRelationError } from '@/lib/supabaseErrors';
import Link from 'next/link';
import { IconCustomers } from '@/components/AppIcons';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { authedFetch } from '@/lib/api';

type TenantRow = Record<string, any>;

function fmLabel(fm: { id: string; full_name?: string | null; email?: string | null } | null | undefined): string {
  if (!fm) return '—';
  return fm.full_name || fm.email || fm.id;
}

export default function CustomersPage() {
  const qc = useQueryClient();

  useRealtimeInvalidation([
    { table: 'tenant_profiles', invalidate: [['tenant_profiles'], ['vw_admin_kpis']] },
    { table: 'fm_profiles', invalidate: [['fm_profiles']] }
  ]);

  const tenantsQuery = useQuery({
    queryKey: ['tenant_profiles'],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await authedFetch('/api/admin/tenants', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load tenants');
      return (json?.tenants ?? []) as TenantRow[];
    }
  });

  const prefetchCustomerDetail = (tenantId: string) => {
    const id = String(tenantId ?? '').trim();
    if (!id) return;

    qc.prefetchQuery({
      queryKey: ['customer_detail', id],
      staleTime: 30_000,
      queryFn: async () => {
        const res = await authedFetch(`/api/admin/customers/${encodeURIComponent(id)}`, { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load tenant');
        return json;
      }
    });
  };

  const missing = tenantsQuery.error ? isMissingRelationError(tenantsQuery.error) : false;

  const fmById = useMemo(() => new Map<string, any>(), []);

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Customers / Tenants</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                List tenants and view profiles, wallet, and purchases.
              </p>
            </div>
            <IconCustomers className="h-7 w-7 text-primary mt-1" />
          </div>
        </div>

        {missing && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Tenant profiles table not found</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              Create/apply the tenant schema (tenant profiles + RLS policies) before enabling Phase 6.
            </p>
            <p className="text-sm text-red-500 mt-2">{formatSupabaseError(tenantsQuery.error)}</p>
          </div>
        )}

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tenants list</h2>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                Claim status, assigned meter number, and quick links.
              </p>
            </div>
            <button
              type="button"
              className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              onClick={() => qc.invalidateQueries({ queryKey: ['tenant_profiles'] })}
            >
              Refresh
            </button>
          </div>

          {tenantsQuery.error && !missing && (
            <p className="text-sm text-red-500 mt-3">{formatSupabaseError(tenantsQuery.error)}</p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                  <th className="py-2 pr-3">Tenant</th>
                  <th className="py-2 pr-3">Customer ID</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Claim</th>
                  <th className="py-2 pr-3">Meter</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3"> </th>
                </tr>
              </thead>
              <tbody>
                {(tenantsQuery.data ?? []).map((t) => {
                  const id = String(t.id ?? '');
                  const claimedById = t.claimed_by_fm_id as string | null | undefined;
                  const claimStatus = (t.claim_status ?? (claimedById ? 'claimed' : 'unclaimed')) as string;
                  const claimedByFm = (t.claimed_by_fm ?? null) as any;
                  const isClaimed = claimStatus === 'claimed' || !!claimedById;
                  return (
                    <tr key={id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top">
                        <div className="font-medium">{t.full_name ?? t.email ?? id}</div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary">{t.email ?? ''}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">{t.customer_id ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">{t.account_status ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">
                        <div>
                          <span
                            className={
                              'inline-flex items-center rounded-control px-2 py-1 text-xs font-medium ' +
                              (isClaimed
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200')
                            }
                          >
                            {isClaimed ? 'claimed' : 'unclaimed'}
                          </span>
                        </div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                          {claimedById ? fmLabel(claimedByFm) : ''}
                        </div>
                      </td>
                      <td className="py-2 pr-3 align-top">{t.meter_number ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-3 align-top text-right">
                        <Link
                          href={('/customers/' + id) as any}
                          className="text-primary hover:underline"
                          onMouseEnter={() => prefetchCustomerDetail(id)}
                          onFocus={() => prefetchCustomerDetail(id)}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!tenantsQuery.isLoading && (tenantsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={7}>
                      No tenants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
