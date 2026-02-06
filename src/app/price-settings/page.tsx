'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PinGate } from '@/components/PinGate';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { IconPriceSettings } from '@/components/AppIcons';
import { authedFetch } from '@/lib/api';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';

interface TariffSetting {
  id: number;
  global_rate_per_kg: number;
  uplift_first_n_kg_per_month: number;
  uplift_amount_per_kg: number;
  updated_at: string;
}

interface BuildingOverride {
  building_id: string;
  rate_per_kg: number;
  updated_at?: string;
  buildings?: {
    address: string;
  }[];
}

type BuildingRow = {
  id: string;
  address?: string | null;
  name?: string | null;
};

type BuildingsApiRow = {
  id: string;
  address?: string | null;
  name?: string | null;
};

type BuildingsApiResponse = {
  ok?: boolean;
  buildings?: BuildingsApiRow[];
  error?: string;
};

type AuditMeta = {
  scope?: unknown;
  buildingIds?: unknown;
  buildingLabels?: unknown;
  pricePerKg?: unknown;
  upliftFirstNKgPerMonth?: unknown;
  upliftAmountPerKg?: unknown;
};

type AuditEntry = {
  id: string | number;
  user_email?: string | null;
  action?: string | null;
  entity_type?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: AuditMeta | null;
  created_at: string;
};

export default function PriceSettingsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [globalPrice, setGlobalPrice] = useState('');
  const [upliftFirstNKg, setUpliftFirstNKg] = useState('');
  const [upliftAmountPerKg, setUpliftAmountPerKg] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [buildingSearch, setBuildingSearch] = useState('');
  const [buildingPrice, setBuildingPrice] = useState('');
  const [selectedBuildingLabels, setSelectedBuildingLabels] = useState<Record<string, string>>({});
  
  const supabase = useMemo(() => getSupabaseClient(), []);
  const queryClient = useQueryClient();

  useRealtimeInvalidation(
    [
      { table: 'tariff_settings', invalidate: [['tariff_settings'], ['vw_admin_kpis'], ['tariff_audit_history']] },
      { table: 'building_tariff_overrides', invalidate: [['building_tariff_overrides'], ['vw_admin_kpis'], ['tariff_audit_history']] },
      { table: 'buildings', invalidate: [['buildings_pricing']] },
      { table: 'admin_audit_log', invalidate: [['tariff_audit_history']] }
    ],
    unlocked
  );

  // Fetch price change history from audit logs
  const auditHistoryQuery = useQuery({
    queryKey: ['tariff_audit_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, user_email, action, entity_type, old_value, new_value, metadata, created_at')
        .eq('action', 'updated_tariff')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as AuditEntry[];
    },
    enabled: unlocked
  });

  // Fetch global tariff
  const globalTariffQuery = useQuery({
    queryKey: ['tariff_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tariff_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as TariffSetting | null;
    },
    enabled: unlocked
  });

  // Fetch building overrides
  const buildingOverridesQuery = useQuery({
    queryKey: ['building_tariff_overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('building_tariff_overrides')
        .select(`
          building_id,
          rate_per_kg,
          updated_at,
          buildings (address)
        `)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((row): BuildingOverride => {
        const r = (row ?? {}) as Record<string, unknown>;
        const buildingsRaw = r.buildings;
        const buildingsArray = Array.isArray(buildingsRaw)
          ? (buildingsRaw as Array<{ address: string }> )
          : buildingsRaw
            ? ([buildingsRaw] as Array<{ address: string }> )
            : undefined;
        return {
          building_id: String(r.building_id),
          rate_per_kg: Number(r.rate_per_kg),
          updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
          buildings: buildingsArray,
        };
      });
    },
    enabled: unlocked
  });

  // Search buildings using the SAME backend as the Buildings page (avoids RLS / UI duplication)
  const buildingsSearchQuery = useQuery({
    queryKey: ['buildings_admin_search', buildingSearch.trim()],
    queryFn: async () => {
      const q = buildingSearch.trim();
      if (!q) return [] as BuildingRow[];
      const res = await authedFetch(`/api/admin/buildings?q=${encodeURIComponent(q)}&limit=25`, { method: 'GET' });
      const json = (await res.json().catch(() => ({}))) as BuildingsApiResponse;
      if (!res.ok) throw new Error(json?.error || 'Failed to search buildings');
      const rows = Array.isArray(json?.buildings) ? json.buildings : [];
      return rows.map((b) => ({
        id: String(b.id),
        address: b.address ?? null,
        name: b.name ?? null,
      })) as BuildingRow[];
    },
    enabled: unlocked && buildingSearch.trim().length > 0
  });

  const selectedBuildingRows = useMemo(() => {
    const rows: Array<{ id: string; label: string }> = [];
    selectedBuildings.forEach((id) => {
      const label = selectedBuildingLabels[id] || id;
      rows.push({ id: String(id), label: String(label) });
    });
    rows.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return rows;
  }, [selectedBuildings, selectedBuildingLabels]);

  // Set global price mutation
  const setGlobalMutation = useMutation({
    mutationFn: async (payload: { pricePerKg: number; upliftFirstNKgPerMonth: number; upliftAmountPerKg: number }) => {
      const response = await authedFetch('/api/admin/price-settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorJson?.error || 'Failed to update global price');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff_settings'] });
      setGlobalPrice('');
      setUpliftFirstNKg('');
      setUpliftAmountPerKg('');
      alert('Global price updated successfully');
    }
  });

  // Set building prices mutation
  const setBuildingsMutation = useMutation({
    mutationFn: async ({ buildingIds, pricePerKg }: { buildingIds: string[], pricePerKg: number }) => {
      const response = await authedFetch('/api/admin/price-settings/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingIds, pricePerKg })
      });
      if (!response.ok) {
        const errorJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorJson?.error || 'Failed to update building prices');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building_tariff_overrides'] });
      setSelectedBuildings(new Set());
      setBuildingPrice('');
      alert('Building prices updated successfully');
    }
  });

  const handleSetGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(globalPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const upliftNRaw = upliftFirstNKg.trim() === '' ? '0' : upliftFirstNKg;
    const upliftAmtRaw = upliftAmountPerKg.trim() === '' ? '0' : upliftAmountPerKg;
    const upliftN = Number(upliftNRaw);
    const upliftAmt = Number(upliftAmtRaw);
    if (!Number.isFinite(upliftN) || upliftN < 0) {
      alert('Uplift first N kg must be 0 or greater');
      return;
    }
    if (!Number.isFinite(upliftAmt) || upliftAmt < 0) {
      alert('Uplift amount per kg must be 0 or greater');
      return;
    }

    setGlobalMutation.mutate({
      pricePerKg: price,
      upliftFirstNKgPerMonth: upliftN,
      upliftAmountPerKg: upliftAmt,
    });
  };

  const handleSetBuildings = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBuildings.size === 0) {
      alert('Please select at least one building');
      return;
    }
    const price = parseFloat(buildingPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }
    setBuildingsMutation.mutate({
      buildingIds: Array.from(selectedBuildings),
      pricePerKg: price
    });
  };

  const toggleBuildingSelection = (buildingId: string) => {
    const newSelection = new Set(selectedBuildings);
    if (newSelection.has(buildingId)) {
      newSelection.delete(buildingId);
      setSelectedBuildingLabels((prev) => {
        const next = { ...prev };
        delete next[buildingId];
        return next;
      });
    } else {
      newSelection.add(buildingId);
    }
    setSelectedBuildings(newSelection);
  };

  const addBuildingToSelection = (building: BuildingRow) => {
    const id = String(building.id);
    const label = String(building.address || building.name || id);
    setSelectedBuildings((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSelectedBuildingLabels((prev) => ({ ...prev, [id]: label }));
  };

  return (
    <ProtectedRoute>
      <PinGate 
        isUnlocked={unlocked} 
        onUnlock={() => setUnlocked(true)}
        header={
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Price Settings</h1>
                <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                  Manage global and per-building tariffs (password protected)
                </p>
              </div>
              <IconPriceSettings className="h-7 w-7 text-primary" />
            </div>
          </div>
        }
      >
        <div className="space-y-6">

          {/* Global Tariff */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">Global Tariff</h2>
            
            {globalTariffQuery.data && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded">
                <div className="text-sm text-textSecondary">Current Global Rate</div>
                <div className="text-2xl font-bold text-blue-600">
                  ₦{globalTariffQuery.data.global_rate_per_kg.toFixed(2)} / kg
                </div>
                <div className="text-xs text-textSecondary mt-1">
                  Monthly uplift: first {Number(globalTariffQuery.data.uplift_first_n_kg_per_month || 0).toFixed(0)} kg @ +₦{Number(globalTariffQuery.data.uplift_amount_per_kg || 0).toFixed(2)}/kg
                </div>
                <div className="text-xs text-textSecondary mt-1">
                  Last updated: {new Date(globalTariffQuery.data.updated_at).toLocaleString()}
                </div>
              </div>
            )}

            <form onSubmit={handleSetGlobal} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-sm font-medium block mb-2">New Price per kg (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={globalPrice}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next.trim().startsWith('-')) return;
                    setGlobalPrice(next);
                  }}
                  className="input w-32"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Uplift first N kg / month</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={upliftFirstNKg}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next.trim().startsWith('-')) return;
                    setUpliftFirstNKg(next);
                  }}
                  className="input w-40"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Uplift amount per kg (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={upliftAmountPerKg}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next.trim().startsWith('-')) return;
                    setUpliftAmountPerKg(next);
                  }}
                  className="input w-40"
                  placeholder="0.00"
                />
              </div>

              <button 
                type="submit"
                disabled={setGlobalMutation.isPending}
                className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {setGlobalMutation.isPending ? 'Saving...' : 'Save Global Tariff'}
              </button>
            </form>

            {setGlobalMutation.error && (
              <div className="mt-2 text-red-500 text-sm">
                {setGlobalMutation.error instanceof Error ? setGlobalMutation.error.message : 'Failed to update'}
              </div>
            )}
          </div>

          {/* Building Overrides */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">Building Price Overrides</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mb-4">
              Set custom prices for specific buildings. These override the global rate.
            </p>

            {/* Current Overrides */}
            {buildingOverridesQuery.data && buildingOverridesQuery.data.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">Current Overrides</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left text-textSecondary">
                        <th className="pb-2">Building</th>
                        <th className="pb-2">Custom Rate (₦/kg)</th>
                        <th className="pb-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {buildingOverridesQuery.data.map(override => (
                        <tr key={override.building_id}>
                          <td className="py-2">
                            <Link href={`/buildings/${override.building_id}`} className="text-primary hover:underline">
                              {override.buildings?.[0]?.address || 'Unknown'}
                            </Link>
                          </td>
                          <td className="py-2 font-mono">₦{override.rate_per_kg.toFixed(2)}</td>
                          <td className="py-2 text-textSecondary">
                            {new Date(override.updated_at!).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Set New Overrides */}
            <form onSubmit={handleSetBuildings} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Find and select buildings</label>

                <input
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  className="input w-full max-w-md"
                  placeholder="Type a building name/address..."
                />

                <div className="mt-2 max-h-60 overflow-y-auto border rounded p-2 space-y-1">
                  {buildingSearch.trim().length === 0 ? (
                    <div className="p-4 text-center text-sm text-textSecondary">Type to search for buildings…</div>
                  ) : buildingsSearchQuery.isLoading ? (
                    <div className="p-4 text-center text-sm text-textSecondary">Searching…</div>
                  ) : buildingsSearchQuery.error ? (
                    <div className="p-4 text-center text-sm text-red-500">
                      {buildingsSearchQuery.error instanceof Error ? buildingsSearchQuery.error.message : 'Failed to search buildings'}
                    </div>
                  ) : (buildingsSearchQuery.data?.length ?? 0) === 0 ? (
                    <div className="p-4 text-center text-sm text-textSecondary">No buildings match your search</div>
                  ) : (
                    (buildingsSearchQuery.data || []).map((building) => {
                      const id = String(building.id);
                      const label = String(building.address || building.name || id);
                      const checked = selectedBuildings.has(id);
                      return (
                        <label key={id} className="flex items-center gap-2 p-2 hover:bg-surfaceHover rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) toggleBuildingSelection(id);
                              else addBuildingToSelection(building);
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Confirmation list */}
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">Selected buildings ({selectedBuildings.size})</div>
                  {selectedBuildings.size === 0 ? (
                    <div className="text-sm text-textSecondary">No buildings selected yet.</div>
                  ) : (
                    <div className="border rounded">
                      <div className="max-h-48 overflow-y-auto divide-y">
                        {selectedBuildingRows.map((b) => {
                          return (
                            <div key={String(b.id)} className="flex items-center justify-between gap-3 p-2">
                              <div className="text-sm">{b.label}</div>
                              <button
                                type="button"
                                onClick={() => toggleBuildingSelection(String(b.id))}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 items-end">
                <div>
                  <label className="text-sm font-medium block mb-2">New Price per kg (₦)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={buildingPrice}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next.trim().startsWith('-')) return;
                      setBuildingPrice(next);
                    }}
                    className="input w-32"
                    placeholder="0.00"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={setBuildingsMutation.isPending || selectedBuildings.size === 0}
                  className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {setBuildingsMutation.isPending ? 'Saving...' : 'Set Building Prices'}
                </button>
              </div>
            </form>

            {setBuildingsMutation.error && (
              <div className="mt-2 text-red-500 text-sm">
                {setBuildingsMutation.error instanceof Error ? setBuildingsMutation.error.message : 'Failed to update'}
              </div>
            )}
          </div>

          {/* Price Change History */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">Price Change History</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mb-4">
              Recent tariff changes logged in the audit trail.
            </p>

            {auditHistoryQuery.isLoading ? (
              <div className="text-sm text-textSecondary">Loading history...</div>
            ) : auditHistoryQuery.error ? (
              <div className="text-sm text-red-500">Failed to load audit history</div>
            ) : !auditHistoryQuery.data || auditHistoryQuery.data.length === 0 ? (
              <div className="text-sm text-textSecondary">No price changes recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-textSecondary">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Admin</th>
                      <th className="pb-2">Scope</th>
                      <th className="pb-2">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(auditHistoryQuery.data as AuditEntry[]).map((entry) => {
                      const meta = (entry.metadata ?? {}) as AuditMeta;
                      const scopeRaw = meta.scope;
                      const buildingIdsRaw = meta.buildingIds;
                      const buildingLabelsRaw = meta.buildingLabels;

                      const buildingIds: string[] = Array.isArray(buildingIdsRaw)
                        ? buildingIdsRaw.map((x) => String(x))
                        : [];

                      const buildingLabels: Array<{ id?: string; label?: string }> = Array.isArray(buildingLabelsRaw)
                        ? buildingLabelsRaw
                            .map((x) => {
                              const r = (x ?? {}) as Record<string, unknown>;
                              return {
                                id: r.id != null ? String(r.id) : undefined,
                                label: r.label != null ? String(r.label) : undefined,
                              };
                            })
                            .filter((x) => Boolean(x.id || x.label))
                        : [];

                      const scope = scopeRaw === 'buildings' ? `${buildingIds.length} building(s)` : 'Global';
                      const buildingLabelText =
                        scopeRaw === 'buildings'
                          ? (buildingLabels
                              .map((b) => b?.label || b?.id)
                              .filter(Boolean)
                              .slice(0, 6)
                              .join(', ') || null)
                          : null;
                      const extraBuildingCount =
                        scopeRaw === 'buildings' && buildingLabels.length > 6 ? buildingLabels.length - 6 : 0;

                      const newVal = (entry.new_value ?? {}) as Record<string, unknown>;
                      const rate = (newVal.global_rate_per_kg as unknown) ?? meta.pricePerKg ?? '-';
                      const upliftNRaw = (newVal.uplift_first_n_kg_per_month as unknown) ?? meta.upliftFirstNKgPerMonth ?? 0;
                      const upliftAmtRaw = (newVal.uplift_amount_per_kg as unknown) ?? meta.upliftAmountPerKg ?? 0;

                      const upliftN = Number(upliftNRaw);
                      const upliftAmt = Number(upliftAmtRaw);
                      const upliftNNum = Number.isFinite(upliftN) ? upliftN : 0;
                      const upliftAmtNum = Number.isFinite(upliftAmt) ? upliftAmt : 0;

                      const numericRate = typeof rate === 'number' ? rate : Number(rate);
                      const rateText = Number.isFinite(numericRate) ? `₦${numericRate.toFixed(2)}/kg` : String(rate);
                      
                      return (
                        <tr key={entry.id}>
                          <td className="py-2 text-textSecondary">
                            {new Date(entry.created_at).toLocaleString()}
                          </td>
                          <td className="py-2">{entry.user_email || 'Unknown'}</td>
                          <td className="py-2">
                            <div>{scope}</div>
                            {buildingLabelText ? (
                              <div className="text-xs text-textSecondary">
                                {buildingLabelText}
                                {extraBuildingCount > 0 ? ` (+${extraBuildingCount} more)` : ''}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2">
                            <span className="font-mono">{rateText}</span>
                            {upliftNNum > 0 && (
                              <span className="ml-2 text-xs text-textSecondary">
                                (first {upliftNNum}kg: +₦{upliftAmtNum.toFixed(2)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="card p-5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
            <h3 className="font-medium mb-2">⚠️ Important Notes</h3>
            <ul className="text-sm text-textSecondary space-y-1 list-disc list-inside">
              <li>Price changes affect all future purchases immediately</li>
              <li>Building overrides take precedence over the global rate</li>
              <li>Existing purchases are not affected by price changes</li>
              <li>All price changes are logged in the audit trail</li>
            </ul>
          </div>
        </div>
      </PinGate>
    </ProtectedRoute>
  );
}
