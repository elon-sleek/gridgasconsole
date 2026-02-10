'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useState, useMemo, createContext, useContext } from 'react';

export type DurationOption = 'today' | '1m' | '3m' | '1y' | 'custom';
type MetricOption = 'usage' | 'topups' | 'fm_growth' | 'tenant_growth' | 'revenue' | 'price_changes';

export const DURATION_LABELS: Record<DurationOption, string> = {
  today: 'Today',
  '1m': '1 Month',
  '3m': '3 Months',
  '1y': '1 Year',
  custom: 'Custom',
};

// Context for sharing date range across dashboard
interface DateRangeContextValue {
  duration: DurationOption;
  setDuration: (d: DurationOption) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
  startDate: string;
  endDate: string;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function useDashboardDateRange() {
  return useContext(DateRangeContext);
}

export function DashboardDateRangeProvider({ children }: { children: React.ReactNode }) {
  const [duration, setDuration] = useState<DurationOption>('1m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (duration) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case '1m':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3m':
        start.setMonth(start.getMonth() - 3);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'custom':
        if (customStart) start = new Date(customStart);
        if (customEnd) end.setTime(new Date(customEnd).getTime());
        break;
    }

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [duration, customStart, customEnd]);

  return (
    <DateRangeContext.Provider value={{
      duration,
      setDuration,
      customStart,
      setCustomStart,
      customEnd,
      setCustomEnd,
      startDate,
      endDate,
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

const METRIC_LABELS: Record<MetricOption, string> = {
  usage: 'Gas Usage (kg)',
  topups: 'Daily Top-ups',
  fm_growth: 'FM Growth',
  tenant_growth: 'Tenant Growth',
  revenue: 'Revenue (₦)',
  price_changes: 'Price Changes',
};

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function AreaChart({ values, label }: { values: number[]; label?: string }) {
  const w = 600;
  const h = 200;
  const pad = 24;

  if (values.length < 2) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-textSecondary dark:text-dark-textSecondary">
        Waiting for data...
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);

  const points = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (values.length - 1);
      const y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`;

  return (
    <div className="relative">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="text-primary">
        {/* Grid lines */}
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.1" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.1" />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={pad}
            y1={pad + (h - pad * 2) * ratio}
            x2={w - pad}
            y2={pad + (h - pad * 2) * ratio}
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeDasharray="4"
          />
        ))}

        {/* Area fill */}
        <polygon points={areaPoints} fill="currentColor" fillOpacity="0.1" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y-axis labels */}
        <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
          {max.toLocaleString()}
        </text>
        <text x={pad - 4} y={h - pad} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
          {min.toLocaleString()}
        </text>
      </svg>
      {label && (
        <div className="absolute bottom-2 right-4 text-xs text-textSecondary dark:text-dark-textSecondary">
          {label}
        </div>
      )}
    </div>
  );
}

function BarChart({ values, label }: { values: number[]; label?: string }) {
  const w = 600;
  const h = 200;
  const pad = 24;

  if (values.length < 1) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-textSecondary dark:text-dark-textSecondary">
        Waiting for data...
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const barCount = Math.min(values.length, 60);
  const barW = (w - pad * 2) / barCount;

  return (
    <div className="relative">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="text-primary">
        {/* Grid */}
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.1" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.1" />

        {values.slice(-barCount).map((v, i) => {
          const scaled = max > 0 ? v / max : 0;
          const barH = (h - pad * 2) * Math.max(0, Math.min(1, scaled));
          const x = pad + i * barW;
          const y = h - pad - barH;
          return (
            <rect
              key={i}
              x={x + 1}
              y={y}
              width={Math.max(2, barW - 2)}
              height={barH}
              rx={2}
              fill="currentColor"
              opacity={0.85}
            />
          );
        })}

        {/* Y-axis labels */}
        <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
          {max.toLocaleString()}
        </text>
        <text x={pad - 4} y={h - pad} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
          0
        </text>
      </svg>
      {label && (
        <div className="absolute bottom-2 right-4 text-xs text-textSecondary dark:text-dark-textSecondary">
          {label}
        </div>
      )}
    </div>
  );
}

/** Animated placeholder skeleton chart shown while data loads / on error / empty */
function SkeletonChart({ message, submessage }: { message?: string; submessage?: string }) {
  const w = 600;
  const h = 200;
  const pad = 24;
  // Generate a gentle sine-wave placeholder
  const pts = Array.from({ length: 30 }, (_, i) => {
    const x = pad + (i * (w - pad * 2)) / 29;
    const y = h / 2 + Math.sin(i * 0.45) * 40 + Math.cos(i * 0.22) * 20;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="text-primary/20"
        aria-hidden
      >
        {/* Subtle grid */}
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.3" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.3" />
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={pad}
            y1={pad + (h - pad * 2) * r}
            x2={w - pad}
            y2={pad + (h - pad * 2) * r}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="4"
          />
        ))}

        {/* Animated area */}
        <polygon points={area} fill="currentColor" fillOpacity="0.25">
          <animate attributeName="opacity" values="0.18;0.35;0.18" dur="2.4s" repeatCount="indefinite" />
        </polygon>

        {/* Animated line */}
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.4s" repeatCount="indefinite" />
        </polyline>
      </svg>

      {/* Overlay message */}
      {message && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm text-textSecondary dark:text-dark-textSecondary">{message}</span>
          {submessage && (
            <span className="text-xs text-textSecondary/70 dark:text-dark-textSecondary/70 mt-1">{submessage}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Standalone duration filter bar that can be used separately
export function DurationFilterBar() {
  const ctx = useDashboardDateRange();
  if (!ctx) return null;

  const { duration, setDuration, customStart, setCustomStart, customEnd, setCustomEnd } = ctx;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Duration selector */}
      <div className="flex rounded-control overflow-hidden border border-border dark:border-dark-border">
        {Object.entries(DURATION_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDuration(key as DurationOption)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              duration === key
                ? 'bg-primary text-white'
                : 'bg-surface dark:bg-dark-surface text-textSecondary dark:text-dark-textSecondary hover:bg-surfaceHover'
            } ${key !== 'today' ? 'border-l border-border dark:border-dark-border' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {duration === 'custom' && (
        <div className="flex gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-2 py-1 text-sm"
          />
        </div>
      )}
    </div>
  );
}

export function DashboardCharts() {
  // Use context if available, otherwise local state
  const ctx = useDashboardDateRange();
  const [localDuration, setLocalDuration] = useState<DurationOption>('1m');
  const [localCustomStart, setLocalCustomStart] = useState('');
  const [localCustomEnd, setLocalCustomEnd] = useState('');

  const duration = ctx?.duration ?? localDuration;
  const setDuration = ctx?.setDuration ?? setLocalDuration;
  const customStart = ctx?.customStart ?? localCustomStart;
  const setCustomStart = ctx?.setCustomStart ?? setLocalCustomStart;
  const customEnd = ctx?.customEnd ?? localCustomEnd;
  const setCustomEnd = ctx?.setCustomEnd ?? setLocalCustomEnd;

  const [metric, setMetric] = useState<MetricOption>('usage');

  // Calculate date range based on duration (use context if available)
  const { startDate, endDate } = ctx ? { startDate: ctx.startDate, endDate: ctx.endDate } : useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (duration) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case '1m':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3m':
        start.setMonth(start.getMonth() - 3);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'custom':
        if (customStart) start = new Date(customStart);
        if (customEnd) end.setTime(new Date(customEnd).getTime());
        break;
    }

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [duration, customStart, customEnd]);

  // Usage trend query
  const usageQuery = useQuery({
    queryKey: ['chart_usage', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('admin_usage_trend', {
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: metric === 'usage',
    retry: 1,
  });

  // Daily topups query
  const topupsQuery = useQuery({
    queryKey: ['chart_topups', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('admin_daily_topups', {
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: metric === 'topups',
    retry: 1,
  });

  // FM growth query
  const fmGrowthQuery = useQuery({
    queryKey: ['chart_fm_growth', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('admin_growth_over_time', {
        entity_type: 'fm',
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: metric === 'fm_growth',
    retry: 1,
  });

  // Tenant growth query
  const tenantGrowthQuery = useQuery({
    queryKey: ['chart_tenant_growth', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('admin_growth_over_time', {
        entity_type: 'tenant',
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: metric === 'tenant_growth',
    retry: 1,
  });

  // Revenue query (from wallet transactions)
  const revenueQuery = useQuery({
    queryKey: ['chart_revenue', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      // Try to get daily revenue from wallet_transactions
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('amount, created_at')
        .eq('type', 'purchase')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Group by day
      const dailyRevenue: Record<string, number> = {};
      (data || []).forEach((tx: any) => {
        const day = tx.created_at.split('T')[0];
        dailyRevenue[day] = (dailyRevenue[day] || 0) + Math.abs(Number(tx.amount) || 0);
      });
      
      return Object.entries(dailyRevenue).map(([day, total]) => ({ day, total }));
    },
    enabled: metric === 'revenue',
    retry: 1,
  });

  // Price changes query
  const priceChangesQuery = useQuery({
    queryKey: ['chart_price_changes', startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, new_value, metadata, created_at')
        .eq('action', 'updated_tariff')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      return (data || []).map((entry: any) => {
        const rate = entry.new_value?.global_rate_per_kg ?? entry.metadata?.pricePerKg ?? 0;
        return { date: entry.created_at, rate: Number(rate) };
      });
    },
    enabled: metric === 'price_changes',
    retry: 1,
  });

  // Get current query based on selected metric
  const currentQuery = {
    usage: usageQuery,
    topups: topupsQuery,
    fm_growth: fmGrowthQuery,
    tenant_growth: tenantGrowthQuery,
    revenue: revenueQuery,
    price_changes: priceChangesQuery,
  }[metric];

  // Extract values based on metric
  const chartValues = useMemo(() => {
    const data = currentQuery.data as any[];
    if (!data || data.length === 0) return [];

    switch (metric) {
      case 'usage':
        return data.map((r) => toNumber(r.total_consumed_kg)).filter((n): n is number => n !== null);
      case 'topups':
        return data.map((r) => toNumber(r.total_kg)).filter((n): n is number => n !== null);
      case 'fm_growth':
      case 'tenant_growth':
        return data.map((r) => toNumber(r.cumulative_count)).filter((n): n is number => n !== null);
      case 'revenue':
        return data.map((r) => toNumber(r.total)).filter((n): n is number => n !== null);
      case 'price_changes':
        return data.map((r) => toNumber(r.rate)).filter((n): n is number => n !== null);
      default:
        return [];
    }
  }, [currentQuery.data, metric]);

  const isBarChart = metric === 'topups';
  const latestValue = chartValues.length > 0 ? chartValues[chartValues.length - 1] : null;
  const totalSum = chartValues.reduce((a, b) => a + b, 0);

  return (
    <div className="card p-5">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
            {METRIC_LABELS[metric]} over {DURATION_LABELS[duration].toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Metric selector */}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricOption)}
            className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm"
          >
            {Object.entries(METRIC_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Duration selector */}
          <div className="flex rounded-control overflow-hidden border border-border dark:border-dark-border">
            {Object.entries(DURATION_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDuration(key as DurationOption)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  duration === key
                    ? 'bg-primary text-white'
                    : 'bg-surface dark:bg-dark-surface text-textSecondary dark:text-dark-textSecondary hover:bg-surfaceHover'
                } ${key !== 'today' ? 'border-l border-border dark:border-dark-border' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range inputs */}
      {duration === 'custom' && (
        <div className="flex gap-3 mb-4">
          <div>
            <label className="text-xs text-textSecondary block mb-1">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-textSecondary block mb-1">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      {/* Stats summary */}
      {chartValues.length > 0 && (
        <div className="flex gap-6 mb-4">
          <div>
            <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Latest</div>
            <div className="text-xl font-semibold">
              {metric === 'revenue' || metric === 'price_changes' ? '₦' : ''}
              {latestValue?.toLocaleString()}
              {metric === 'usage' || metric === 'topups' ? ' kg' : ''}
            </div>
          </div>
          {(metric === 'usage' || metric === 'topups' || metric === 'revenue') && (
            <div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Total</div>
              <div className="text-xl font-semibold">
                {metric === 'revenue' ? '₦' : ''}
                {totalSum.toLocaleString()}
                {metric === 'usage' || metric === 'topups' ? ' kg' : ''}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Data Points</div>
            <div className="text-xl font-semibold">{chartValues.length}</div>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="bg-surfaceHover dark:bg-dark-surface/50 rounded-lg p-4">
        {currentQuery.isLoading ? (
          <SkeletonChart message="Loading chart data…" />
        ) : currentQuery.error ? (
          <SkeletonChart
            message={(() => {
              const err = currentQuery.error as any;
              return typeof err?.message === 'string' ? err.message : 'Error loading data';
            })()}
            submessage="Data will appear here once available"
          />
        ) : chartValues.length === 0 ? (
          <SkeletonChart message="No data yet for this period" submessage="Activity will populate this chart" />
        ) : isBarChart ? (
          <BarChart values={chartValues} label={`${chartValues.length} data points`} />
        ) : (
          <AreaChart values={chartValues} label={`${chartValues.length} data points`} />
        )}
      </div>
    </div>
  );
}
