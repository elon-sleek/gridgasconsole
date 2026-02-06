'use client';

/**
 * Phase 7.11 & 9.1: Admin Deliveries Page
 * 
 * Displays:
 * - Toggle between List view and Map view
 * - Live delivery map (FMs currently on delivery with live locations)
 * - Delivery history table
 * - Vendor plant markers
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { MapPin, Truck, Package, Clock, CheckCircle, XCircle, AlertTriangle, List, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import DeliveriesMap from '../../components/DeliveriesMap';

type DeliveryBatch = {
  id: string;
  fm_id: string;
  vendor_id: string | null;
  total_tanks_count: number;
  total_kg: number;
  status: string;
  batched_at: string | null;
  vendor_accepted_at: string | null;
  fm_confirmed_at: string | null;
  completed_at: string | null;
  total_amount_paid: number | null;
  created_at: string;
  fm_profiles?: { full_name: string; phone?: string | null } | null;
  gas_vendors?: { name: string } | null;
};

type FMLocation = {
  fm_id: string;
  delivery_batch_id: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
  fm_profiles?: { full_name: string } | null;
};

const statusColors: Record<string, string> = {
  batching: 'bg-gray-100 text-gray-700',
  en_route_pickup: 'bg-blue-100 text-blue-700',
  tanks_collected: 'bg-indigo-100 text-indigo-700',
  vendor_selection: 'bg-purple-100 text-purple-700',
  vendor_reservation_sent: 'bg-yellow-100 text-yellow-700',
  vendor_accepted: 'bg-green-100 text-green-700',
  en_route_vendor: 'bg-blue-100 text-blue-700',
  at_vendor: 'bg-cyan-100 text-cyan-700',
  vendor_refilling: 'bg-orange-100 text-orange-700',
  vendor_batch_filled: 'bg-amber-100 text-amber-700',
  fm_confirmed_payment: 'bg-emerald-100 text-emerald-700',
  en_route_return: 'bg-blue-100 text-blue-700',
  delivery_complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  disputed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  batching: 'Batching',
  en_route_pickup: 'En Route (Pickup)',
  tanks_collected: 'Tanks Collected',
  vendor_selection: 'Selecting Vendor',
  vendor_reservation_sent: 'Awaiting Vendor',
  vendor_accepted: 'Vendor Accepted',
  en_route_vendor: 'En Route (Vendor)',
  at_vendor: 'At Vendor',
  vendor_refilling: 'Refilling',
  vendor_batch_filled: 'Filled',
  fm_confirmed_payment: 'Payment Confirmed',
  en_route_return: 'Returning',
  delivery_complete: 'Complete',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export default function DeliveriesPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fmFilter, setFmFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Fetch FMs for filter dropdown
  const fmsQuery = useQuery({
    queryKey: ['fm_profiles_for_filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fm_profiles')
        .select('id, full_name:name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch vendors for filter dropdown
  const vendorsQuery = useQuery({
    queryKey: ['vendors_for_filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gas_vendors')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Active deliveries query
  const activeDeliveriesQuery = useQuery({
    queryKey: ['active_deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .select(`
          *,
          fm_profiles(full_name:name, phone),
          gas_vendors(name)
        `)
        .not('status', 'in', '(delivery_complete,cancelled,disputed)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DeliveryBatch[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Delivery history query
  const historyQuery = useQuery({
    queryKey: ['delivery_history', statusFilter, fmFilter, vendorFilter],
    queryFn: async () => {
      let query = supabase
        .from('delivery_batches')
        .select(`
          *,
          fm_profiles(full_name:name, phone),
          gas_vendors(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (fmFilter !== 'all') {
        query = query.eq('fm_id', fmFilter);
      }
      if (vendorFilter !== 'all') {
        query = query.eq('vendor_id', vendorFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryBatch[];
    },
  });

  // FM live locations query
  const locationsQuery = useQuery({
    queryKey: ['fm_live_locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fm_latest_locations')
        .select('*')
        .not('delivery_batch_id', 'is', null);

      if (error) throw error;
      return (data ?? []) as unknown as FMLocation[];
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  const fmNameById = useMemo(() => {
    const map = new Map<string, string>();
    (fmsQuery.data ?? []).forEach((fm: any) => {
      if (fm?.id && typeof fm?.full_name === 'string') map.set(fm.id, fm.full_name);
    });
    return map;
  }, [fmsQuery.data]);

  const fmLocationsWithNames = useMemo(() => {
    return (locationsQuery.data ?? []).map((l) => ({
      ...l,
      fm_profiles: { full_name: fmNameById.get(l.fm_id) ?? 'Unknown FM' },
    }));
  }, [locationsQuery.data, fmNameById]);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Deliveries</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                Track FM deliveries in real-time and view history.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-border dark:border-dark-border overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary text-white' 
                      : 'bg-surface dark:bg-dark-surface hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-2 transition-colors ${
                    viewMode === 'map' 
                      ? 'bg-primary text-white' 
                      : 'bg-surface dark:bg-dark-surface hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Map View"
                >
                  <MapIcon className="h-4 w-4" />
                </button>
              </div>
              <Truck className="h-7 w-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            label="Active Deliveries"
            value={activeDeliveriesQuery.data?.length ?? 0}
            icon={<Truck className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            label="At Vendors"
            value={activeDeliveriesQuery.data?.filter(d => ['at_vendor', 'vendor_refilling'].includes(d.status)).length ?? 0}
            icon={<Package className="h-5 w-5" />}
            color="orange"
          />
          <StatsCard
            label="Awaiting Confirmation"
            value={activeDeliveriesQuery.data?.filter(d => d.status === 'vendor_batch_filled').length ?? 0}
            icon={<Clock className="h-5 w-5" />}
            color="yellow"
          />
          <StatsCard
            label="Live FMs"
            value={locationsQuery.data?.length ?? 0}
            icon={<MapPin className="h-5 w-5" />}
            color="green"
          />
        </div>

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Live Delivery Map</h2>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  locationsQuery.refetch();
                  activeDeliveriesQuery.refetch();
                }}
              >
                Refresh
              </button>
            </div>
            <DeliveriesMap 
              fmLocations={fmLocationsWithNames}
              activeDeliveries={activeDeliveriesQuery.data ?? []}
              className="h-[48rem]"
            />
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {/* Active Deliveries */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active Deliveries</h2>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => activeDeliveriesQuery.refetch()}
            >
              Refresh
            </button>
          </div>

          {activeDeliveriesQuery.isLoading && (
            <div className="py-8 text-center text-textSecondary">Loading...</div>
          )}

          {activeDeliveriesQuery.error && (
            <div className="py-4 text-red-500 text-sm">
              {formatSupabaseError(activeDeliveriesQuery.error)}
            </div>
          )}

          {!activeDeliveriesQuery.isLoading && (activeDeliveriesQuery.data?.length ?? 0) === 0 && (
            <div className="py-8 text-center text-textSecondary dark:text-dark-textSecondary">
              No active deliveries
            </div>
          )}

          <div className="space-y-3">
            {activeDeliveriesQuery.data?.map((batch) => (
              <ActiveDeliveryCard key={batch.id} batch={batch} />
            ))}
          </div>
        </div>

        {/* Delivery History */}
        <div className="card p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Delivery History</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="delivery_complete">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="disputed">Disputed</option>
                <option value="batching">Batching</option>
                <option value="en_route_pickup">En Route (Pickup)</option>
                <option value="at_vendor">At Vendor</option>
                <option value="en_route_return">Returning</option>
              </select>
              <select
                value={fmFilter}
                onChange={(e) => setFmFilter(e.target.value)}
                className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm"
              >
                <option value="all">All FMs</option>
                {fmsQuery.data?.map((fm: any) => (
                  <option key={fm.id} value={fm.id}>{fm.full_name ?? fm.id}</option>
                ))}
              </select>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm"
              >
                <option value="all">All Vendors</option>
                {vendorsQuery.data?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {historyQuery.isLoading && (
            <div className="py-8 text-center text-textSecondary">Loading...</div>
          )}

          {historyQuery.error && (
            <div className="py-4 text-red-500 text-sm">
              {formatSupabaseError(historyQuery.error)}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">FM</th>
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Tanks</th>
                  <th className="py-2 pr-3">KG</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data?.map((batch) => (
                  <tr key={batch.id} className="border-b border-border dark:border-dark-border hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted">
                    <td className="py-2 pr-3">
                      <Link href={`/deliveries/${batch.id}`} className="text-primary hover:underline">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {batch.fm_profiles?.full_name ?? '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {batch.gas_vendors?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3">{batch.total_tanks_count}</td>
                    <td className="py-2 pr-3">{batch.total_kg}</td>
                    <td className="py-2 pr-3">
                      {batch.total_amount_paid != null
                        ? `₦${batch.total_amount_paid.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status] ?? 'bg-gray-100'}`}>
                        {statusLabels[batch.status] ?? batch.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-textSecondary dark:text-dark-textSecondary">
                      No deliveries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

function StatsCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ActiveDeliveryCard({ batch }: { batch: DeliveryBatch }) {
  const StatusIcon = () => {
    switch (batch.status) {
      case 'delivery_complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
      case 'disputed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'vendor_batch_filled':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Truck className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <Link href={`/deliveries/${batch.id}`} className="block p-4 rounded-lg border border-border dark:border-dark-border hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <StatusIcon />
          <div>
            <div className="font-medium">
              {batch.fm_profiles?.full_name ?? 'Unknown FM'}
            </div>
            <div className="text-sm text-textSecondary dark:text-dark-textSecondary">
              {batch.total_tanks_count} tanks • {batch.total_kg} kg
              {batch.gas_vendors?.name && ` → ${batch.gas_vendors.name}`}
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status] ?? 'bg-gray-100'}`}>
          {statusLabels[batch.status] ?? batch.status}
        </span>
      </div>
    </Link>
  );
}
