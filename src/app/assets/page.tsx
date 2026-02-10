'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatSupabaseError, isMissingRelationError } from '@/lib/supabaseErrors';
import { authedFetch } from '@/lib/api';
import { IconAssets } from '@/components/AppIcons';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';

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
  created_at?: string | null;
  created_by?: string | null;
};

type FmRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  status?: string | null;
};

function safeId(row: any): string {
  return String(row?.id ?? '');
}

function getLabelForFm(fm: FmRow): string {
  return fm.full_name || fm.email || fm.id;
}

function AssetTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs px-2 py-1 rounded-control border border-border dark:border-dark-border">
      {type}
    </span>
  );
}

export default function AssetsPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => getSupabaseClient(), []);

  useRealtimeInvalidation([
    { table: 'assets', invalidate: [['assets'], ['vw_admin_kpis']] },
    { table: 'asset_assignments', invalidate: [['assets'], ['vw_admin_kpis']] }
  ]);

  const [type, setType] = useState<AssetType>('meter');
  const [meterNumber, setMeterNumber] = useState('');
  const [serial, setSerial] = useState('');
  const [capacityKg, setCapacityKg] = useState<string>('');
  const [manufacturer, setManufacturer] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [installAddress, setInstallAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Record<string, boolean>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedFmId, setSelectedFmId] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const assetsQuery = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssetRow[];
    }
  });

  const fmsQuery = useQuery({
    queryKey: ['fm_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fm_profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FmRow[];
    }
  });

  const createAsset = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const capacityNumber = capacityKg.trim() ? Number(capacityKg) : null;
      if (capacityNumber != null) {
        if (!Number.isFinite(capacityNumber)) {
          throw new Error('Capacity must be a valid number');
        }
        if (capacityNumber < 0) {
          throw new Error('Capacity cannot be negative');
        }
      }

      const res = await authedFetch('/api/admin/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          meterNumber: type === 'meter' ? meterNumber.trim() : null,
          serial: type !== 'meter' ? serial.trim() : null,
          capacityKg: Number.isFinite(capacityNumber as any) ? capacityNumber : null,
          manufacturer: manufacturer.trim() || null,
          firmwareVersion: firmwareVersion.trim() || null,
          installAddress: installAddress.trim() || null
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to create asset');
    },
    onSuccess: async () => {
      setMeterNumber('');
      setSerial('');
      setCapacityKg('');
      setManufacturer('');
      setFirmwareVersion('');
      setInstallAddress('');
      await qc.invalidateQueries({ queryKey: ['assets'] });
      await qc.invalidateQueries({ queryKey: ['vw_admin_kpis'] });
    },
    onError: (err) => setFormError(formatSupabaseError(err))
  });

  const assignAssets = useMutation({
    mutationFn: async () => {
      setAssignError(null);
      const ids = Object.keys(selectedAssetIds).filter((k) => selectedAssetIds[k]);
      if (!ids.length) throw new Error('Select at least one asset');
      if (!selectedFmId) throw new Error('Select a Facility Manager');

      const res = await authedFetch('/api/admin/assets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: ids, fmId: selectedFmId })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to assign assets');
    },
    onSuccess: async () => {
      setAssignOpen(false);
      setSelectedAssetIds({});
      setSelectedFmId('');
      await qc.invalidateQueries({ queryKey: ['assets'] });
      await qc.invalidateQueries({ queryKey: ['vw_admin_kpis'] });
    },
    onError: (err) => setAssignError(formatSupabaseError(err))
  });

  const selectedCount = useMemo(
    () => Object.keys(selectedAssetIds).filter((k) => selectedAssetIds[k]).length,
    [selectedAssetIds]
  );

  const assetsMissing = assetsQuery.error ? isMissingRelationError(assetsQuery.error) : false;
  const fmsMissing = fmsQuery.error ? isMissingRelationError(fmsQuery.error) : false;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Assets</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                Register meters/tanks/changeovers and assign them to Facility Managers.
              </p>
            </div>
            <IconAssets className="h-7 w-7 text-primary mt-1" />
          </div>
        </div>

        {assetsMissing && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Assets tables not found</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              Your database does not have the required tables yet (e.g. <span className="font-medium">assets</span>,
              <span className="font-medium"> asset_assignments</span>). Create/apply the schema before enabling Phase 4 fully.
            </p>
            <p className="text-sm text-red-500 mt-2">{formatSupabaseError(assetsQuery.error)}</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Register asset</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Creates a new asset record.</p>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createAsset.mutate();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={type}
                    onChange={(e) => setType(e.target.value as AssetType)}
                  >
                    <option value="meter">Meter</option>
                    <option value="tank">Tank</option>
                    <option value="changeover">Changeover</option>
                  </select>
                </div>
                {type === 'meter' ? (
                  <div>
                    <label className="text-sm font-medium">Meter number</label>
                    <input
                      className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                      value={meterNumber}
                      onChange={(e) => setMeterNumber(e.target.value)}
                      placeholder="e.g. MTR-0001"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium">Serial / ID</label>
                    <input
                      className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      placeholder="e.g. TANK-0001"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Capacity</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={capacityKg}
                    onChange={(e) => setCapacityKg(e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Manufacturer</label>
                  <input
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Firmware version</label>
                  <input
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={firmwareVersion}
                    onChange={(e) => setFirmwareVersion(e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Install address</label>
                  <input
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={installAddress}
                    onChange={(e) => setInstallAddress(e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <button
                type="submit"
                disabled={createAsset.isPending}
                className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {createAsset.isPending ? 'Creating…' : 'Create asset'}
              </button>
            </form>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Assign assets</h2>
                <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                  Select assets from the list and assign them to an FM.
                </p>
              </div>
              <button
                type="button"
                className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted disabled:opacity-60"
                disabled={!selectedCount}
                onClick={() => {
                  setAssignError(null);
                  setAssignOpen(true);
                }}
              >
                Assign ({selectedCount})
              </button>
            </div>

            {assignOpen && (
              <div className="mt-4 border border-border dark:border-dark-border rounded-control p-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Facility Manager</label>
                  <select
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={selectedFmId}
                    onChange={(e) => setSelectedFmId(e.target.value)}
                    disabled={fmsQuery.isLoading || !!fmsMissing}
                  >
                    <option value="">Select FM…</option>
                    {(fmsQuery.data ?? []).map((fm) => (
                      <option key={fm.id} value={fm.id}>
                        {getLabelForFm(fm)}
                      </option>
                    ))}
                  </select>
                  {fmsQuery.error && <p className="text-sm text-red-500 mt-2">{formatSupabaseError(fmsQuery.error)}</p>}
                </div>

                {assignError && <p className="text-sm text-red-500">{assignError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                    disabled={assignAssets.isPending}
                    onClick={() => assignAssets.mutate()}
                  >
                    {assignAssets.isPending ? 'Assigning…' : 'Confirm assignment'}
                  </button>
                  <button
                    type="button"
                    className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
                    onClick={() => setAssignOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Assets list</h2>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                Click an asset for full metadata and assignment history.
              </p>
            </div>
            <button
              type="button"
              className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              onClick={() => qc.invalidateQueries({ queryKey: ['assets'] })}
            >
              Refresh
            </button>
          </div>

          {assetsQuery.error && !assetsMissing && <p className="text-sm text-red-500 mt-3">{formatSupabaseError(assetsQuery.error)}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                  <th className="py-2 pr-3 w-10"> </th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Serial</th>
                  <th className="py-2 pr-3">Manufacturer</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3"> </th>
                </tr>
              </thead>
              <tbody>
                {(assetsQuery.data ?? []).map((a: any) => {
                  const id = safeId(a);
                  const checked = !!selectedAssetIds[id];
                  return (
                    <tr key={id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelectedAssetIds((prev) => ({ ...prev, [id]: e.target.checked }))}
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <AssetTypeBadge type={a.type ?? 'unknown'} />
                      </td>
                      <td className="py-2 pr-3 align-top">{a.serial ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">{a.manufacturer ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-3 align-top text-right">
                        <Link
                          href={("/assets/" + id) as any}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!assetsQuery.isLoading && (assetsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={6}>
                      No assets found.
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
