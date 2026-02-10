'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { useSessionStore } from '@/lib/sessionStore';
import { Shell } from '@/components/Shell';
import { LoginForm } from '@/components/LoginForm';
import { DashboardCharts, DashboardDateRangeProvider, DurationFilterBar, useDashboardDateRange, DURATION_LABELS } from '@/components/DashboardCharts';
import { useMemo, useState } from 'react';
import { IconDashboard } from '@/components/AppIcons';
import { 
  Users, 
  UserCheck, 
  UserCog,
  Package, 
  Building2, 
  Store, 
  MessageSquare, 
  PackageX, 
  Truck,
  TrendingUp,
  Wallet,
  ShoppingCart,
} from 'lucide-react';

type AdminKpis = {
  total_tenants: number;
  total_active_tenants: number;
  total_fms: number;
  total_meters: number;
  total_tanks: number;
  total_changeovers: number;
  total_assets: number;
  total_assets_assigned: number;
  total_assets_assigned_to_fms?: number;
  total_assets_assigned_to_tenants?: number;
  total_assets_unassigned: number;
  total_buildings: number;
  total_gas_vendors: number;
  gas_deliveries_completed: number;
  support_tickets_open: number;
};

function KpiTile({ label, value, icon, color }: { label: string; value: number | string; icon?: React.ReactNode; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
    pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</p>
          <p className="text-2xl font-semibold mt-2">{value}</p>
        </div>
        {icon && color && (
          <div className={`p-2 rounded-lg ${colorClasses[color] ?? colorClasses.blue}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleTile({
  label,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  isLoading
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  isLoading: boolean;
}) {
  const [side, setSide] = useState<'left' | 'right'>('left');

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</p>
        <div className="flex rounded-control overflow-hidden border border-border dark:border-dark-border">
          <button
            type="button"
            onClick={() => setSide('left')}
            className={
              'px-2 py-1 text-xs ' +
              (side === 'left'
                ? 'bg-primary text-white'
                : 'bg-surface dark:bg-dark-surface text-textSecondary dark:text-dark-textSecondary')
            }
          >
            {leftLabel}
          </button>
          <button
            type="button"
            onClick={() => setSide('right')}
            className={
              'px-2 py-1 text-xs border-l border-border dark:border-dark-border ' +
              (side === 'right'
                ? 'bg-primary text-white'
                : 'bg-surface dark:bg-dark-surface text-textSecondary dark:text-dark-textSecondary')
            }
          >
            {rightLabel}
          </button>
        </div>
      </div>
      <p className="text-2xl font-semibold mt-2">
        {isLoading ? '…' : side === 'left' ? leftValue : rightValue}
      </p>
    </div>
  );
}

export default function Home() {
  const user = useSessionStore((s) => s.user);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vw_admin_kpis'],
    enabled: !!user,
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('vw_admin_kpis').select('*').single();
      if (error) throw error;
      return data as AdminKpis;
    }
  });

  useRealtimeInvalidation(
    [
      // Core dashboard counts
      {
        table: 'tenant_profiles',
        invalidate: [
          ['vw_admin_kpis'],
          ['time_filtered_kpis'],
          ['chart_usage'],
          ['chart_tenant_growth'],
        ]
      },
      {
        table: 'fm_profiles',
        invalidate: [
          ['vw_admin_kpis'],
          ['time_filtered_kpis'],
          ['chart_fm_growth'],
        ]
      },
      {
        table: 'buildings',
        invalidate: [
          ['vw_admin_kpis'],
        ]
      },
      {
        table: 'assets',
        invalidate: [
          ['vw_admin_kpis'],
        ]
      },
      {
        table: 'asset_assignments',
        invalidate: [
          ['vw_admin_kpis'],
        ]
      },
      {
        table: 'support_tickets',
        invalidate: [
          ['vw_admin_kpis'],
        ]
      },
      {
        table: 'gas_vendors',
        invalidate: [
          ['vw_admin_kpis'],
        ]
      },
      {
        table: 'vendor_deliveries',
        invalidate: [
          ['vw_admin_kpis'],
          ['time_filtered_kpis'],
        ]
      },

      // Charts + period metrics data sources
      {
        table: 'gas_purchases',
        invalidate: [
          ['chart_topups'],
        ]
      },
      {
        table: 'meter_telemetry',
        invalidate: [
          ['chart_usage'],
        ]
      },
      {
        table: 'wallet_transactions',
        invalidate: [
          ['chart_revenue'],
          ['time_filtered_kpis'],
        ]
      },
      {
        table: 'admin_audit_log',
        invalidate: [
          ['chart_price_changes'],
        ]
      },
    ],
    !!user,
    15_000,
  );
  // Move useMemo before conditional return to fix React Hooks order
  const assignedToFms = useMemo(() => {
    if (!data) return 0;
    if (typeof data.total_assets_assigned_to_fms === 'number') return data.total_assets_assigned_to_fms;
    return data.total_assets_assigned ?? 0;
  }, [data]);

  const assignedToTenants = useMemo(() => {
    if (!data) return 0;
    if (typeof data.total_assets_assigned_to_tenants === 'number') return data.total_assets_assigned_to_tenants;
    return data.total_assets_assigned ?? 0;
  }, [data]);

  if (!user) {
    return <LoginForm redirectTo="/" />;
  }

  return (
    <Shell>
      <DashboardDateRangeProvider>
        <DashboardContent
          data={data}
          isLoading={isLoading}
          error={error}
          assignedToFms={assignedToFms}
          assignedToTenants={assignedToTenants}
        />
      </DashboardDateRangeProvider>
    </Shell>
  );
}

// Time-filtered KPI component that uses shared date range
function TimeFilteredKpis() {
  const ctx = useDashboardDateRange();
  
  const { data, isLoading } = useQuery({
    queryKey: ['time_filtered_kpis', ctx?.startDate, ctx?.endDate],
    enabled: !!ctx,
    queryFn: async () => {
      if (!ctx) return null;
      const supabase = getSupabaseClient();
      
      // Get new tenants in period
      const { count: newTenants } = await supabase
        .from('tenant_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', ctx.startDate)
        .lte('created_at', ctx.endDate);

      // Get new FMs in period
      const { count: newFms } = await supabase
        .from('fm_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', ctx.startDate)
        .lte('created_at', ctx.endDate);

      // Get purchases in period
      const { data: purchases } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('type', 'purchase')
        .gte('created_at', ctx.startDate)
        .lte('created_at', ctx.endDate);

      const totalPurchases = (purchases || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
      const purchaseCount = purchases?.length ?? 0;

      // Get deliveries in period
      const { count: deliveries } = await supabase
        .from('vendor_deliveries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', ctx.startDate)
        .lte('created_at', ctx.endDate);

      return {
        newTenants: newTenants ?? 0,
        newFms: newFms ?? 0,
        totalPurchases,
        purchaseCount,
        deliveries: deliveries ?? 0,
      };
    },
  });

  const durationLabel = ctx ? DURATION_LABELS[ctx.duration].toLowerCase() : '';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Period Metrics</h2>
          <p className="text-xs text-textSecondary dark:text-dark-textSecondary">
            Activity in the selected time period ({durationLabel})
          </p>
        </div>
        <DurationFilterBar />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {isLoading ? '…' : data?.newTenants ?? 0}
          </div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">New Tenants</div>
        </div>
        <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <div className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
            {isLoading ? '…' : data?.newFms ?? 0}
          </div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">New FMs</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
            {isLoading ? '…' : data?.purchaseCount ?? 0}
          </div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">Purchases</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
            ₦{isLoading ? '…' : (data?.totalPurchases ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">Revenue</div>
        </div>
        <div className="text-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
          <div className="text-2xl font-semibold text-cyan-600 dark:text-cyan-400">
            {isLoading ? '…' : data?.deliveries ?? 0}
          </div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">Deliveries</div>
        </div>
      </div>
    </div>
  );
}

function DashboardContent({
  data,
  isLoading,
  error,
  assignedToFms,
  assignedToTenants,
}: {
  data: AdminKpis | undefined;
  isLoading: boolean;
  error: any;
  assignedToFms: number;
  assignedToTenants: number;
}) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Dashboard</p>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
              Monitor and track key performance indicators.
            </p>
          </div>
          <IconDashboard className="h-7 w-7 text-primary mt-1" />
        </div>
      </div>

      {error ? (
        <div className="card p-5">
          <h2 className="text-lg font-semibold">KPI data not available</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
            Ensure the SQL in <span className="font-medium">supabase/admin_portal/admin_views.sql</span> has been applied to your Supabase project.
          </p>
          <p className="text-sm text-red-500 mt-2">{(error as any)?.message ?? 'Failed to load KPIs'}</p>
        </div>
      ) : (
        <>
          {/* Time-filtered metrics with duration selector */}
          <TimeFilteredKpis />

          {/* Static totals */}
          <div className="grid gap-4 md:grid-cols-3">
            <KpiTile 
              label="Total tenants" 
              value={isLoading ? '…' : data?.total_tenants ?? 0} 
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
            <KpiTile 
              label="Active tenants" 
              value={isLoading ? '…' : data?.total_active_tenants ?? 0} 
              icon={<UserCheck className="h-5 w-5" />}
              color="green"
            />
            <KpiTile 
              label="Facility Managers" 
              value={isLoading ? '…' : data?.total_fms ?? 0} 
              icon={<UserCog className="h-5 w-5" />}
              color="indigo"
            />

            <KpiTile 
              label="Total assets" 
              value={isLoading ? '…' : data?.total_assets ?? 0} 
              icon={<Package className="h-5 w-5" />}
              color="purple"
            />

            <ToggleTile
              label="Assigned assets"
              leftLabel="To FMs"
              rightLabel="To Tenants"
              leftValue={assignedToFms}
              rightValue={assignedToTenants}
              isLoading={isLoading}
            />

            <KpiTile 
              label="Unassigned assets" 
              value={isLoading ? '…' : data?.total_assets_unassigned ?? 0} 
              icon={<PackageX className="h-5 w-5" />}
              color="yellow"
            />

            <KpiTile 
              label="Buildings" 
              value={isLoading ? '…' : data?.total_buildings ?? 0} 
              icon={<Building2 className="h-5 w-5" />}
              color="indigo"
            />
            <KpiTile 
              label="Gas vendors" 
              value={isLoading ? '…' : data?.total_gas_vendors ?? 0} 
              icon={<Store className="h-5 w-5" />}
              color="orange"
            />
            <KpiTile 
              label="Deliveries (completed)" 
              value={isLoading ? '…' : data?.gas_deliveries_completed ?? 0} 
              icon={<Truck className="h-5 w-5" />}
              color="cyan"
            />

            <KpiTile 
              label="Open tickets" 
              value={isLoading ? '…' : data?.support_tickets_open ?? 0} 
              icon={<MessageSquare className="h-5 w-5" />}
              color="red"
            />
          </div>

          <DashboardCharts />
        </>
      )}
    </div>
  );
}
