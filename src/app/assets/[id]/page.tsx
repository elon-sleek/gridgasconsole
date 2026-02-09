'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { authedFetch } from '@/lib/api';
import { formatSupabaseError, isMissingRelationError } from '@/lib/supabaseErrors';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';

type AssetType = 'meter' | 'tank' | 'changeover';

type AssetRow = {
  id: string;
  type: AssetType;
  serial?: string | null;
  meter_id?: string | null;
  capacity_kg?: number | null;
  manufacturer?: string | null;
  firmware_version?: string | null;
  building_id?: string | null;
  install_address?: string | null;
  vendor_device_id?: string | null;
  vendor_api_ref?: any;
  created_at?: string | null;
  created_by?: string | null;
};

type AssignmentRow = {
  id: string;
  asset_id: string;
  assigned_to_type: 'fm' | 'tenant';
  assigned_to_fm_id?: string | null;
  assigned_to_tenant_id?: string | null;
  status: 'assigned' | 'retrieved' | 'cancelled' | string;
  assigned_by?: string | null;
  assigned_at?: string | null;
  retrieved_at?: string | null;
  note?: string | null;
};

type FmRow = { id: string; full_name?: string | null; email?: string | null };

type TenantRow = { id: string; full_name?: string | null; email?: string | null; customer_id?: string | null };

function fmLabel(fm: FmRow | undefined): string {
  if (!fm) return '—';
  return fm.full_name || fm.email || fm.id;
}

function tenantLabel(t: TenantRow | undefined): string {
  if (!t) return '—';
  return t.full_name || t.email || t.customer_id || t.id;
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const assetId = String(id ?? '').trim();

  const qc = useQueryClient();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [selectedFmId, setSelectedFmId] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);

  const assetQuery = useQuery({
    queryKey: ['assets', assetId],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();
      if (error) throw error;
      return data as unknown as AssetRow;
    },
    enabled: !!assetId
  });

  const assignmentsQuery = useQuery({
    queryKey: ['asset_assignments', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_assignments')
        .select('*')
        .eq('asset_id', assetId)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
    enabled: !!assetId
  });

  const fmsQuery = useQuery({
    queryKey: ['fm_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fm_profiles').select('*');
      if (error) throw error;
      return (data ?? []) as unknown as FmRow[];
    }
  });

  const fmIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignmentsQuery.data ?? []) {
      if (a.assigned_to_fm_id) ids.add(String(a.assigned_to_fm_id));
    }
    return Array.from(ids);
  }, [assignmentsQuery.data]);

  const tenantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignmentsQuery.data ?? []) {
      if (a.assigned_to_tenant_id) ids.add(String(a.assigned_to_tenant_id));
    }
    return Array.from(ids);
  }, [assignmentsQuery.data]);

  const tenantsQuery = useQuery({
    queryKey: ['tenant_profiles_by_ids', tenantIds.join(',')],
    queryFn: async () => {
      if (!tenantIds.length) return [] as TenantRow[];
      const { data, error } = await supabase
        .from('tenant_profiles')
        .select('id, full_name, email, customer_id')
        .in('id', tenantIds);
      if (error) throw error;
      return (data ?? []) as unknown as TenantRow[];
    },
    enabled: tenantIds.length > 0
  });

  const fmById = useMemo(() => {
    const map = new Map<string, FmRow>();
    for (const fm of fmsQuery.data ?? []) map.set(fm.id, fm);
    return map;
  }, [fmsQuery.data]);

  const tenantById = useMemo(() => {
    const map = new Map<string, TenantRow>();
    for (const t of tenantsQuery.data ?? []) map.set(t.id, t);
    return map;
  }, [tenantsQuery.data]);

  const activeAssignment = useMemo(() => {
    return (assignmentsQuery.data ?? []).find((a) => a.status === 'assigned' && !a.retrieved_at) ?? null;
  }, [assignmentsQuery.data]);

  const retrieveAssignment = useMutation({
    mutationFn: async () => {
      setRetrieveError(null);
      const res = await authedFetch(`/api/admin/assets/${assetId}/retrieve`, {
        method: 'POST'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to retrieve/unassign asset');
      return json as { ok: boolean; retrievedCount: number };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['asset_assignments', assetId] });
      await qc.invalidateQueries({ queryKey: ['assets'] });
      await qc.invalidateQueries({ queryKey: ['assets', assetId] });
    },
    onError: (err) => setRetrieveError(formatSupabaseError(err))
  });

  const assignToFm = useMutation({
    mutationFn: async () => {
      setAssignError(null);
      const fmId = selectedFmId.trim();
      if (!fmId) throw new Error('Select a Facility Manager');

      const res = await authedFetch('/api/admin/assets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: [assetId], fmId })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to assign asset');
    },
    onSuccess: async () => {
      setSelectedFmId('');
      await qc.invalidateQueries({ queryKey: ['asset_assignments', assetId] });
      await qc.invalidateQueries({ queryKey: ['assets'] });
      await qc.invalidateQueries({ queryKey: ['assets', assetId] });
    },
    onError: (err) => setAssignError(formatSupabaseError(err))
  });

  const assetsMissing = assetQuery.error ? isMissingRelationError(assetQuery.error) : false;
  const assignmentsMissing = assignmentsQuery.error ? isMissingRelationError(assignmentsQuery.error) : false;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-textSecondary dark:text-dark-textSecondary">
                <Link href="/assets" className="hover:underline">
                  Assets
                </Link>
                <span> / </span>
                <span>Detail</span>
              </div>
              <h1 className="text-2xl font-semibold mt-1">Asset</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                Full metadata and assignment history.
              </p>
            </div>
            <button
              type="button"
              className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['assets', assetId] });
                qc.invalidateQueries({ queryKey: ['asset_assignments', assetId] });
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {(assetsMissing || assignmentsMissing) && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Assets tables not found</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              Your database is missing required tables (e.g. <span className="font-medium">assets</span>,{' '}
              <span className="font-medium">asset_assignments</span>). Apply the admin portal migrations.
            </p>
            {(assetQuery.error || assignmentsQuery.error) && (
              <p className="text-sm text-red-500 mt-2">{formatSupabaseError(assetQuery.error ?? assignmentsQuery.error)}</p>
            )}
          </div>
        )}

        {assetQuery.error && !assetsMissing && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Failed to load asset</h2>
            <p className="text-sm text-red-500 mt-2">{formatSupabaseError(assetQuery.error)}</p>
          </div>
        )}

        {assetQuery.data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-lg font-semibold">Metadata</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Type</span><span className="font-medium">{assetQuery.data.type}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Serial</span><span className="font-medium">{assetQuery.data.serial ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Meter ID</span><span className="font-medium">{assetQuery.data.meter_id ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Manufacturer</span><span className="font-medium">{assetQuery.data.manufacturer ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Firmware</span><span className="font-medium">{assetQuery.data.firmware_version ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Capacity (kg)</span><span className="font-medium">{typeof assetQuery.data.capacity_kg === 'number' ? assetQuery.data.capacity_kg : '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Install address</span><span className="font-medium">{assetQuery.data.install_address ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-textSecondary dark:text-dark-textSecondary">Created</span><span className="font-medium">{assetQuery.data.created_at ? new Date(assetQuery.data.created_at).toLocaleString() : '—'}</span></div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Actions</h2>
                <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                  Assign to a Facility Manager or retrieve an active assignment.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to FM</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                    value={selectedFmId}
                    onChange={(e) => setSelectedFmId(e.target.value)}
                    disabled={fmsQuery.isLoading}
                  >
                    <option value="">Select FM…</option>
                    {(fmsQuery.data ?? []).map((fm) => (
                      <option key={fm.id} value={fm.id}>
                        {fmLabel(fm)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={assignToFm.isPending}
                    className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                    onClick={() => assignToFm.mutate()}
                  >
                    {assignToFm.isPending ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
                {assignError && <p className="text-sm text-red-500">{assignError}</p>}
              </div>

              <div className="border-t border-border dark:border-dark-border pt-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Retrieve / Unassign</p>
                    <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                      {activeAssignment
                        ? `Active: ${activeAssignment.assigned_to_type === 'fm' ? 'FM' : 'Tenant'}`
                        : 'No active assignment'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!activeAssignment || retrieveAssignment.isPending}
                    className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted disabled:opacity-60"
                    onClick={() => retrieveAssignment.mutate()}
                  >
                    {retrieveAssignment.isPending ? 'Retrieving…' : 'Retrieve'}
                  </button>
                </div>
                {retrieveError && <p className="text-sm text-red-500">{retrieveError}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="card p-5">
          <h2 className="text-lg font-semibold">Assignment history</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
            Admin-to-FM and FM-to-tenant assignment log.
          </p>

          {assignmentsQuery.error && !assignmentsMissing && (
            <p className="text-sm text-red-500 mt-3">{formatSupabaseError(assignmentsQuery.error)}</p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                  <th className="py-2 pr-3">Assigned to</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Assigned at</th>
                  <th className="py-2 pr-3">Retrieved at</th>
                  <th className="py-2 pr-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {(assignmentsQuery.data ?? []).map((a) => {
                  const who =
                    a.assigned_to_type === 'fm'
                      ? fmLabel(a.assigned_to_fm_id ? fmById.get(String(a.assigned_to_fm_id)) : undefined)
                      : tenantLabel(a.assigned_to_tenant_id ? tenantById.get(String(a.assigned_to_tenant_id)) : undefined);

                  return (
                    <tr key={a.id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top">
                        <div className="font-medium">{a.assigned_to_type.toUpperCase()}</div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary">{who}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">{a.status}</td>
                      <td className="py-2 pr-3 align-top">{a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-3 align-top">{a.retrieved_at ? new Date(a.retrieved_at).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-3 align-top">{a.note ?? '—'}</td>
                    </tr>
                  );
                })}

                {!assignmentsQuery.isLoading && (assignmentsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={5}>
                      No assignment history yet.
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
