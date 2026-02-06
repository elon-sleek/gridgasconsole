'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { formatSupabaseError, isMissingRelationError } from '@/lib/supabaseErrors';
import { authedFetch } from '@/lib/api';
import { IconFacilityManagers } from '@/components/AppIcons';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';

type FmRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function getLabel(fm: FmRow): string {
  return fm.full_name || fm.email || fm.id;
}

export default function FacilityManagersPage() {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  useRealtimeInvalidation([
    { table: 'fm_profiles', invalidate: [['fm_profiles'], ['vw_admin_kpis']] }
  ]);

  const fmsQuery = useQuery({
    queryKey: ['fm_profiles'],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await authedFetch('/api/admin/facility-managers', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load facility managers');
      return (json?.fms ?? []) as FmRow[];
    }
  });

  const prefetchFmDetail = (fmId: string) => {
    const id = String(fmId ?? '').trim();
    if (!id) return;

    qc.prefetchQuery({
      queryKey: ['fm_profile', id],
      staleTime: 30_000,
      queryFn: async () => {
        const res = await authedFetch(`/api/admin/facility-managers/${encodeURIComponent(id)}`, { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load facility manager');
        return json?.fm;
      }
    });
  };

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      setActionError(null);
      const res = await authedFetch(`/api/admin/facility-managers/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update status');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fm_profiles'] });
    },
    onError: (err) => setActionError(formatSupabaseError(err))
  });

  const missing = fmsQuery.error ? isMissingRelationError(fmsQuery.error) : false;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Facility Managers</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                Manage Facility Managers. Control portal access and field operations.
              </p>
            </div>
            <IconFacilityManagers className="h-7 w-7 text-primary mt-1" />
          </div>
        </div>

        {missing && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">FM profiles table not found</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              Create/apply the <span className="font-medium">fm_profiles</span> table (or update the query to match your schema).
            </p>
            <p className="text-sm text-red-500 mt-2">{formatSupabaseError(fmsQuery.error)}</p>
          </div>
        )}

        {actionError && <div className="card p-4 text-sm text-red-500">{actionError}</div>}

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">FM list</h2>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Click an FM to view details.</p>
            </div>
            <button
              type="button"
              className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              onClick={() => qc.invalidateQueries({ queryKey: ['fm_profiles'] })}
            >
              Refresh
            </button>
          </div>

          {fmsQuery.error && !missing && <p className="text-sm text-red-500 mt-3">{formatSupabaseError(fmsQuery.error)}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                  <th className="py-2 pr-3">FM</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Actions</th>
                  <th className="py-2 pr-3"> </th>
                </tr>
              </thead>
              <tbody>
                {(fmsQuery.data ?? []).map((fm) => (
                  <tr key={fm.id} className="border-b border-border dark:border-dark-border">
                    <td className="py-2 pr-3 align-top">
                      <div className="font-medium">{getLabel(fm)}</div>
                      <div className="text-xs text-textSecondary dark:text-dark-textSecondary">{fm.phone ?? ''}</div>
                    </td>
                    <td className="py-2 pr-3 align-top">{fm.status ?? '—'}</td>
                    <td className="py-2 pr-3 align-top">{fm.created_at ? new Date(fm.created_at).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3 align-top">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-control border border-border dark:border-dark-border px-3 py-1 text-xs hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted disabled:opacity-60"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: fm.id, status: 'active' })}
                        >
                          Unblock
                        </button>
                        <button
                          type="button"
                          className="rounded-control border border-border dark:border-dark-border px-3 py-1 text-xs hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted disabled:opacity-60"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: fm.id, status: 'blocked' })}
                        >
                          Block
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 align-top text-right">
                      <Link
                        href={("/facility-managers/" + fm.id) as any}
                        className="text-primary hover:underline"
                        onMouseEnter={() => prefetchFmDetail(fm.id)}
                        onFocus={() => prefetchFmDetail(fm.id)}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {!fmsQuery.isLoading && (fmsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={5}>
                      No Facility Managers found.
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
