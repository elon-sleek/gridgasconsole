'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';

const DEFAULT_KPI_TILES = [
  { id: 'total_customers', label: 'Total Customers' },
  { id: 'total_buildings', label: 'Total Buildings' },
  { id: 'total_meters', label: 'Total Meters' },
  { id: 'total_fms', label: 'Total Facility Managers' },
  { id: 'revenue_30d', label: 'Revenue (30d)' },
  { id: 'vends_30d', label: 'Vends (30d)' },
];

export default function PreferencesPage() {
  const [defaultDateRange, setDefaultDateRange] = useState(30);
  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable' | 'spacious'>(
    'comfortable'
  );
  const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(false);
  const [kpiTileOrder, setKpiTileOrder] = useState<string[]>(DEFAULT_KPI_TILES.map((t) => t.id));
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);

  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('admin_user_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const prefs = data?.preferences || {};
      setDefaultDateRange(prefs.default_date_range || 30);
      setTableDensity(prefs.table_density || 'comfortable');
      setShowOnlyMyTickets(prefs.show_only_my_tickets || false);

      const storedOrder = Array.isArray(prefs.kpi_tile_order) ? prefs.kpi_tile_order : null;
      if (storedOrder && storedOrder.length > 0) {
        const allowed = new Set(DEFAULT_KPI_TILES.map((t) => t.id));
        const cleaned = storedOrder.filter((id: any) => typeof id === 'string' && allowed.has(id));
        const missing = DEFAULT_KPI_TILES.map((t) => t.id).filter((id) => !cleaned.includes(id));
        setKpiTileOrder([...cleaned, ...missing]);
      } else {
        setKpiTileOrder(DEFAULT_KPI_TILES.map((t) => t.id));
      }

      return prefs;
    },
  });

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_date_range: defaultDateRange,
          table_density: tableDensity,
          show_only_my_tickets: showOnlyMyTickets,
          kpi_tile_order: kpiTileOrder,
        }),
      });

      if (!res.ok) throw new Error('Failed to save preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      alert('Preferences saved successfully');
    },
    onError: (error: Error) => {
      alert(`Failed to save: ${error.message}`);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Preferences</h1>
        <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
          Customize your dashboard and data display
        </p>
      </div>

      {/* Date Range Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Default Date Range</h2>
        <div>
          <label className="text-sm font-medium">Charts & Stats Default Period</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={defaultDateRange}
            onChange={(e) => setDefaultDateRange(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
          <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
            Default time period shown when you open dashboard charts
          </p>
        </div>
      </div>

      {/* Table Display Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Table Display</h2>
        <div>
          <label className="text-sm font-medium">Row Density</label>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="density"
                value="compact"
                checked={tableDensity === 'compact'}
                onChange={(e) => setTableDensity('compact')}
                className="rounded-full"
              />
              <div>
                <div className="text-sm font-medium">Compact</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                  More rows visible, less spacing
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="density"
                value="comfortable"
                checked={tableDensity === 'comfortable'}
                onChange={(e) => setTableDensity('comfortable')}
                className="rounded-full"
              />
              <div>
                <div className="text-sm font-medium">Comfortable</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                  Balanced spacing (recommended)
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="density"
                value="spacious"
                checked={tableDensity === 'spacious'}
                onChange={(e) => setTableDensity('spacious')}
                className="rounded-full"
              />
              <div>
                <div className="text-sm font-medium">Spacious</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                  More breathing room, easier to read
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Default Filters</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showOnlyMyTickets}
              onChange={(e) => setShowOnlyMyTickets(e.target.checked)}
              className="rounded"
            />
            <div>
              <div className="text-sm font-medium">Show only my assigned support tickets</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Filter support tickets to only show ones assigned to me by default
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* KPI Tile Order Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">KPI Tile Order</h2>
        <p className="text-xs text-textSecondary dark:text-dark-textSecondary">
          Drag tiles to reorder your dashboard KPIs.
        </p>
        <div className="space-y-2">
          {kpiTileOrder.map((tileId) => {
            const tile = DEFAULT_KPI_TILES.find((t) => t.id === tileId);
            if (!tile) return null;
            return (
              <div
                key={tile.id}
                draggable
                onDragStart={() => setDraggingTileId(tile.id)}
                onDragEnd={() => setDraggingTileId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!draggingTileId || draggingTileId === tile.id) return;
                  setKpiTileOrder((prev) => {
                    const fromIndex = prev.indexOf(draggingTileId);
                    const toIndex = prev.indexOf(tile.id);
                    if (fromIndex < 0 || toIndex < 0) return prev;
                    const next = [...prev];
                    next.splice(fromIndex, 1);
                    next.splice(toIndex, 0, draggingTileId);
                    return next;
                  });
                }}
                className={`flex items-center justify-between rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm cursor-move ${
                  draggingTileId === tile.id ? 'opacity-50' : ''
                }`}
              >
                <span className="font-medium">{tile.label}</span>
                <span className="text-xs text-textSecondary dark:text-dark-textSecondary">Drag</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-control bg-primary text-white px-6 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
