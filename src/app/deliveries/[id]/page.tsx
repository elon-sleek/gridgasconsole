'use client';

/**
 * Phase 7.11.2: Admin Delivery Detail Page
 * 
 * Full timeline replay of a delivery batch including:
 * - All photos (meter readings, tank engagement)
 * - GPS breadcrumbs
 * - Wallet transactions (lock → transfer → settlement)
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Truck, 
  MapPin, 
  Camera, 
  Clock, 
  CheckCircle, 
  XCircle, 
  CreditCard,
  User,
  Package,
  Building
} from 'lucide-react';

type DeliveryBatch = {
  id: string;
  fm_id: string;
  vendor_id: string | null;
  total_tanks_count: number;
  total_kg: number;
  status: string;
  batched_at: string | null;
  vendor_selected_at: string | null;
  vendor_accepted_at: string | null;
  vendor_filled_at: string | null;
  fm_confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  highest_vendor_price_per_kg: number | null;
  vendor_price_per_kg: number | null;
  total_amount_locked: number | null;
  total_amount_paid: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
  fm_profiles?: { id: string; full_name: string; phone?: string | null; email: string } | null;
  gas_vendors?: { id: string; name: string; plant_location: string } | null;
};

type RefillOrder = {
  id: string;
  tank_asset_id: string;
  building_id: string | null;
  status: string;
  opened_at: string;
  picked_up_at: string | null;
  at_vendor_at: string | null;
  refilled_at: string | null;
  returned_at: string | null;
  closed_at: string | null;
  assets?: { serial: string; capacity_kg: number } | null;
  buildings?: { address: string } | null;
};

type DeliveryPhoto = {
  id: string;
  photo_type: string;
  photo_url: string;
  photo_taken_at: string | null;
  uploaded_at: string;
  tank_asset_id: string | null;
};

type WalletLock = {
  id: string;
  locked_amount: number;
  status: string;
  locked_at: string;
  released_at: string | null;
  transferred_at: string | null;
};

type FMLocation = {
  latitude: number;
  longitude: number;
  recorded_at: string;
};

const statusLabels: Record<string, string> = {
  batching: 'Batching Tanks',
  en_route_pickup: 'En Route to Pickup',
  tanks_collected: 'All Tanks Collected',
  vendor_selection: 'Selecting Vendor',
  vendor_reservation_sent: 'Awaiting Vendor Response',
  vendor_accepted: 'Vendor Accepted',
  en_route_vendor: 'En Route to Vendor',
  at_vendor: 'At Vendor Plant',
  vendor_refilling: 'Refilling in Progress',
  vendor_batch_filled: 'Batch Filled',
  fm_confirmed_payment: 'Payment Confirmed',
  en_route_return: 'Returning Tanks',
  delivery_complete: 'Delivery Complete',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;
  const supabase = useMemo(() => getSupabaseClient(), []);

  // Fetch delivery batch
  const batchQuery = useQuery({
    queryKey: ['delivery_batch', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .select(`
          *,
          fm_profiles(id, full_name:name, phone, email),
          gas_vendors(id, name, plant_location)
        `)
        .eq('id', deliveryId)
        .single();

      if (error) throw error;
      return data as unknown as DeliveryBatch;
    },
  });

  // Fetch refill orders in this batch
  const ordersQuery = useQuery({
    queryKey: ['delivery_orders', deliveryId],
    enabled: !!batchQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tank_refill_orders')
        .select(`
          *,
          assets(serial, capacity_kg),
          buildings(address)
        `)
        .eq('delivery_batch_id', deliveryId)
        .order('opened_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as RefillOrder[];
    },
  });

  // Fetch photos for this delivery
  const photosQuery = useQuery({
    queryKey: ['delivery_photos', deliveryId],
    enabled: !!batchQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_photos')
        .select('*')
        .eq('delivery_batch_id', deliveryId)
        .order('uploaded_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as DeliveryPhoto[];
    },
  });

  // Fetch wallet lock
  const walletQuery = useQuery({
    queryKey: ['wallet_lock', deliveryId],
    enabled: !!batchQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_locked_funds')
        .select('*')
        .eq('delivery_batch_id', deliveryId)
        .maybeSingle();

      if (error) throw error;
      return data as WalletLock | null;
    },
  });

  // Fetch FM location breadcrumbs
  const locationsQuery = useQuery({
    queryKey: ['fm_locations', deliveryId],
    enabled: !!batchQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fm_live_locations')
        .select('latitude, longitude, recorded_at')
        .eq('delivery_batch_id', deliveryId)
        .order('recorded_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as FMLocation[];
    },
  });

  const batch = batchQuery.data;

  if (batchQuery.isLoading) {
    return (
      <ProtectedRoute>
        <div className="p-8 text-center text-textSecondary">Loading delivery details...</div>
      </ProtectedRoute>
    );
  }

  if (batchQuery.error || !batch) {
    return (
      <ProtectedRoute>
        <div className="space-y-4">
          <Link href="/deliveries" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Deliveries
          </Link>
          <div className="card p-5 text-red-500">
            {batchQuery.error ? formatSupabaseError(batchQuery.error) : 'Delivery not found'}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/deliveries" className="p-2 hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Delivery Details</h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
              {new Date(batch.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`card p-5 ${
          batch.status === 'delivery_complete' ? 'bg-green-50 dark:bg-green-900/20' :
          batch.status === 'cancelled' || batch.status === 'disputed' ? 'bg-red-50 dark:bg-red-900/20' :
          'bg-blue-50 dark:bg-blue-900/20'
        }`}>
          <div className="flex items-center gap-3">
            {batch.status === 'delivery_complete' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : batch.status === 'cancelled' || batch.status === 'disputed' ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <Truck className="h-6 w-6 text-blue-600" />
            )}
            <div>
              <div className="font-semibold text-lg">{statusLabels[batch.status] ?? batch.status}</div>
              <div className="text-sm opacity-75">
                {batch.total_tanks_count} tanks • {batch.total_kg} kg
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* FM Info */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Facility Manager</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div>{batch.fm_profiles?.full_name ?? '—'}</div>
              <div className="text-textSecondary">{batch.fm_profiles?.email}</div>
              <div className="text-textSecondary">{batch.fm_profiles?.phone ?? ''}</div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Gas Vendor</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div>{batch.gas_vendors?.name ?? 'Not selected'}</div>
              <div className="text-textSecondary">{batch.gas_vendors?.plant_location ?? '—'}</div>
              {batch.vendor_price_per_kg && (
                <div className="text-textSecondary">₦{batch.vendor_price_per_kg}/kg</div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Info */}
        {walletQuery.data && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Payment</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <div className="text-textSecondary">Amount Locked</div>
                <div className="font-medium">₦{walletQuery.data.locked_amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-textSecondary">Lock Status</div>
                <div className={`font-medium ${
                  walletQuery.data.status === 'transferred' ? 'text-green-600' :
                  walletQuery.data.status === 'released' ? 'text-gray-600' : 'text-yellow-600'
                }`}>
                  {walletQuery.data.status}
                </div>
              </div>
              {batch.total_amount_paid && (
                <div>
                  <div className="text-textSecondary">Amount Paid</div>
                  <div className="font-medium text-green-600">₦{batch.total_amount_paid.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Timeline</h3>
          </div>
          <div className="space-y-3">
            <TimelineItem
              label="Batch Created"
              timestamp={batch.batched_at}
              icon={<Package className="h-4 w-4" />}
            />
            <TimelineItem
              label="Vendor Selected"
              timestamp={batch.vendor_selected_at}
              icon={<MapPin className="h-4 w-4" />}
            />
            <TimelineItem
              label="Vendor Accepted"
              timestamp={batch.vendor_accepted_at}
              icon={<CheckCircle className="h-4 w-4" />}
            />
            <TimelineItem
              label="Batch Filled"
              timestamp={batch.vendor_filled_at}
              icon={<Package className="h-4 w-4" />}
            />
            <TimelineItem
              label="Payment Confirmed"
              timestamp={batch.fm_confirmed_at}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <TimelineItem
              label="Delivery Completed"
              timestamp={batch.completed_at}
              icon={<CheckCircle className="h-4 w-4" />}
            />
            {batch.cancelled_at && (
              <TimelineItem
                label="Cancelled"
                timestamp={batch.cancelled_at}
                icon={<XCircle className="h-4 w-4" />}
                isNegative
              />
            )}
          </div>
        </div>

        {/* Tanks/Refill Orders */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Tanks ({ordersQuery.data?.length ?? 0})</h3>
          </div>
          {ordersQuery.isLoading ? (
            <div className="text-textSecondary">Loading...</div>
          ) : (
            <div className="space-y-2">
              {ordersQuery.data?.map((order) => (
                <div key={order.id} className="p-3 rounded-lg border border-border dark:border-dark-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{order.assets?.serial ?? 'Unknown Tank'}</div>
                      <div className="text-sm text-textSecondary">
                        {order.buildings?.address ?? '—'} • {order.assets?.capacity_kg ?? '—'} kg
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              {(ordersQuery.data?.length ?? 0) === 0 && (
                <div className="text-textSecondary text-sm">No tanks in this delivery</div>
              )}
            </div>
          )}
        </div>

        {/* Photos */}
        {(photosQuery.data?.length ?? 0) > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Photos ({photosQuery.data?.length ?? 0})</h3>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {photosQuery.data?.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.photo_url}
                    alt={photo.photo_type}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg">
                    {photo.photo_type.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GPS Breadcrumbs */}
        {(locationsQuery.data?.length ?? 0) > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">GPS Trail ({locationsQuery.data?.length ?? 0} points)</h3>
            </div>
            <div className="text-sm text-textSecondary">
              First: {locationsQuery.data?.[0]?.recorded_at ? new Date(locationsQuery.data[0].recorded_at).toLocaleString() : '—'}
              <br />
              Last: {locationsQuery.data?.[(locationsQuery.data?.length ?? 1) - 1]?.recorded_at 
                ? new Date(locationsQuery.data[(locationsQuery.data.length ?? 1) - 1].recorded_at).toLocaleString() 
                : '—'}
            </div>
            {/* TODO: Add Leaflet map with GPS trail */}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function TimelineItem({ 
  label, 
  timestamp, 
  icon,
  isNegative = false 
}: { 
  label: string; 
  timestamp: string | null; 
  icon: React.ReactNode;
  isNegative?: boolean;
}) {
  if (!timestamp) return null;

  return (
    <div className="flex items-center gap-3">
      <div className={`p-1.5 rounded-full ${isNegative ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className={`font-medium ${isNegative ? 'text-red-600' : ''}`}>{label}</div>
        <div className="text-xs text-textSecondary">{new Date(timestamp).toLocaleString()}</div>
      </div>
    </div>
  );
}
