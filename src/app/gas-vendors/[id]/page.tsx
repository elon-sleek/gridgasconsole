'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { authedFetch } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MapPin, Truck, Package, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

interface GasVendor {
  id: string;
  name: string;
  plant_location?: string;
  capacity_kg?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  plant_lat?: number | null;
  plant_lng?: number | null;
  verified_at?: string | null;
}

interface VendorDelivery {
  id: string;
  vendor_id: string;
  fm_id: string;
  quantity_kg: number;
  delivered_at?: string;
  status: string;
  proof_url?: string;
  note?: string;
  created_at: string;
  fm_profiles?: {
    full_name: string;
    email: string;
  };
}

interface FM {
  id: string;
  full_name: string;
  email: string;
}

interface DeliveryBatch {
  id: string;
  fm_id: string;
  total_tanks_count: number;
  total_kg: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_amount_paid: number | null;
  fm_profiles?: { full_name: string } | null;
}

interface VendorPricing {
  id: string;
  price_per_kg: number;
  effective_from: string;
  effective_until: string | null;
}

interface VendorDetailPayload {
  ok: boolean;
  vendor: GasVendor;
  profile: any | null;
  currentPrice: { price_per_kg?: number; effective_from?: string } | null;
  priceHistory: VendorPricing[];
  plants?: Array<{
    id: string;
    vendor_id: string;
    address?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    capacity_kg?: number | null;
    ownership_type?: string | null;
    lease_document_url?: string | null;
    status?: string | null;
    created_at?: string | null;
  }>;
}

function formatDateTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function GasVendorDetailPage() {
  const params = useParams();
  const vendorId = params.id as string;
  const supabase = useMemo(() => getSupabaseClient(), []);
  const queryClient = useQueryClient();

  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [formData, setFormData] = useState({
    fmId: '',
    quantityKg: '',
    status: 'ongoing',
    proofUrl: '',
    note: ''
  });

  // Fetch vendor details (service-role admin endpoint)
  const vendorQuery = useQuery({
    queryKey: ['gas_vendor_admin_detail', vendorId],
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/gas-vendors/${vendorId}`, { method: 'GET' });
      const json = (await res.json().catch(() => ({}))) as Partial<VendorDetailPayload> & { error?: string };
      if (!res.ok) throw new Error(json?.error || 'Failed to load vendor detail');
      return json as VendorDetailPayload;
    }
  });

  // Fetch vendor deliveries
  const deliveriesQuery = useQuery({
    queryKey: ['vendor_deliveries', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_deliveries')
        .select(`
          *,
          fm_profiles (full_name:name, email)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VendorDelivery[];
    }
  });

  // Fetch FMs for delivery form
  const fmsQuery = useQuery({
    queryKey: ['fm_profiles_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fm_profiles')
        .select('id, full_name:name, email')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as FM[];
    },
    enabled: showDeliveryForm
  });

  // Fetch delivery batches (new 12-step workflow)
  const batchesQuery = useQuery({
    queryKey: ['delivery_batches', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .select(`
          *,
          fm_profiles(full_name:name)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryBatch[];
    }
  });


  // Record delivery mutation
  const recordDeliveryMutation = useMutation({
    mutationFn: async (deliveryData: any) => {
      const response = await fetch('/api/admin/vendor-deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record delivery');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_deliveries', vendorId] });
      setShowDeliveryForm(false);
      setFormData({ fmId: '', quantityKg: '', status: 'ongoing', proofUrl: '', note: '' });
      alert('Delivery recorded successfully');
    }
  });

  const handleSubmitDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    recordDeliveryMutation.mutate({
      vendorId,
      fmId: formData.fmId,
      quantityKg: parseFloat(formData.quantityKg),
      status: formData.status,
      proofUrl: formData.proofUrl || null,
      note: formData.note || null
    });
  };

  if (vendorQuery.isLoading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="text-textSecondary">Loading vendor details...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (vendorQuery.error) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="text-red-500">
            Error: {vendorQuery.error instanceof Error ? vendorQuery.error.message : 'Failed to load vendor'}
          </div>
          <Link href="/gas-vendors" className="text-primary hover:underline mt-4 inline-block">
            ← Back to Vendors
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const vendor = vendorQuery.data!.vendor;
  const ongoingDeliveries = deliveriesQuery.data?.filter(d => d.status === 'ongoing') || [];
  const completedDeliveries = deliveriesQuery.data?.filter(d => d.status === 'completed') || [];

  // Calculate KPIs from delivery_batches
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const batchDeliveries7d = batchesQuery.data?.filter(d => 
    new Date(d.created_at) >= sevenDaysAgo && d.status === 'delivery_complete'
  ).length ?? 0;

  const batchDeliveries30d = batchesQuery.data?.filter(d => 
    new Date(d.created_at) >= thirtyDaysAgo && d.status === 'delivery_complete'
  ).length ?? 0;

  const kgDelivered30d = batchesQuery.data
    ?.filter(d => new Date(d.created_at) >= thirtyDaysAgo && d.status === 'delivery_complete')
    .reduce((sum, d) => sum + (d.total_kg ?? 0), 0) ?? 0;

  const revenue30d = batchesQuery.data
    ?.filter(d => new Date(d.created_at) >= thirtyDaysAgo && d.status === 'delivery_complete')
    .reduce((sum, d) => sum + (d.total_amount_paid ?? 0), 0) ?? 0;

  const disputes = batchesQuery.data?.filter(d => d.status === 'disputed').length ?? 0;
  const currentPrice = vendorQuery.data?.currentPrice ?? null;
  const priceHistory = vendorQuery.data?.priceHistory ?? [];
  const plants = vendorQuery.data?.plants ?? [];

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/gas-vendors" className="text-primary hover:underline mb-2 inline-block text-sm">
              ← Back to Vendors
            </Link>
            <h1 className="text-2xl font-bold">{vendor.name}</h1>
            <p className="text-textSecondary text-sm">{vendor.plant_location || 'No location specified'}</p>
          </div>
          <button
            onClick={() => setShowDeliveryForm(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-control"
          >
            Record Delivery
          </button>
        </div>

        {/* Vendor Info */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Vendor Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-textSecondary">Name</div>
              <div className="font-medium">{vendor.name}</div>
            </div>
            
            {vendor.plant_location && (
              <div>
                <div className="text-sm text-textSecondary">Plant Location</div>
                <div className="font-medium">{vendor.plant_location}</div>
              </div>
            )}
            
            {vendor.capacity_kg && (
              <div>
                <div className="text-sm text-textSecondary">Capacity</div>
                <div className="font-medium">{vendor.capacity_kg.toLocaleString()} kg</div>
              </div>
            )}

            <div>
              <div className="text-sm text-textSecondary">Status</div>
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                vendor.is_active 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {vendor.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <div className="text-sm text-textSecondary">Registered</div>
              <div className="font-medium">{new Date(vendor.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Branches / Plants */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-2">Branches / Plants</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
            All registered plant addresses for this vendor.
          </p>

          <div className="mt-4 space-y-3">
            {plants.length === 0 ? (
              <div className="text-sm text-textSecondary">No branches found.</div>
            ) : (
              plants.map((p) => {
                const addr = (p.address ?? p.address_line ?? '—') as string;
                const meta = [p.city, p.state].filter(Boolean).join(', ');
                const cap = typeof p.capacity_kg === 'number' ? `${p.capacity_kg} kg` : null;
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border dark:border-dark-border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{addr}</div>
                        {meta && (
                          <div className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                            {meta}
                          </div>
                        )}
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
                          Status: {p.status ?? '—'} • Ownership: {p.ownership_type ?? '—'}
                          {cap ? ` • Capacity: ${cap}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        {p.lease_document_url ? (
                          <a
                            href={p.lease_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View lease proof
                          </a>
                        ) : (
                          <div className="text-xs text-textSecondary">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Delivery Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{batchDeliveries7d}</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Deliveries (7d)</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{batchDeliveries30d}</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Deliveries (30d)</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{kgDelivered30d.toLocaleString()}</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">KG (30d)</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">₦{revenue30d.toLocaleString()}</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Revenue (30d)</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${disputes > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{disputes}</div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Disputes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Pricing */}
        {currentPrice?.price_per_kg != null && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-2">Current Pricing</h2>
            <div className="text-2xl font-bold text-primary">₦{currentPrice.price_per_kg}/kg</div>
            <div className="text-sm text-textSecondary mt-1">
              {currentPrice.effective_from ? `Effective from ${formatDateTime(currentPrice.effective_from)}` : ''}
            </div>
          </div>
        )}

        {/* Price History */}
        {priceHistory.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-4">Price History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-textSecondary">
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Effective From</th>
                    <th className="pb-2">Effective Until</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {priceHistory.map((p) => (
                    <tr key={p.id} className="text-sm">
                      <td className="py-2 font-medium">₦{p.price_per_kg}/kg</td>
                      <td className="py-2">{formatDateTime(p.effective_from)}</td>
                      <td className="py-2">{p.effective_until ? formatDateTime(p.effective_until) : 'Current'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coordinates & Verification */}
        {(vendor.plant_lat != null || vendor.verified_at) && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-4">Location & Verification</h2>
            <div className="grid grid-cols-2 gap-4">
              {vendor.plant_lat != null && vendor.plant_lng != null && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-sm text-textSecondary">Coordinates</div>
                    <div className="font-mono text-sm">{vendor.plant_lat.toFixed(5)}, {vendor.plant_lng.toFixed(5)}</div>
                  </div>
                </div>
              )}
              {vendor.verified_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-sm text-textSecondary">Verified</div>
                    <div className="font-medium">{new Date(vendor.verified_at).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery History */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Delivery History</h2>
          
          {deliveriesQuery.isLoading ? (
            <div className="text-textSecondary">Loading deliveries...</div>
          ) : deliveriesQuery.error ? (
            <div className="text-red-500 text-sm">Error loading deliveries</div>
          ) : deliveriesQuery.data && deliveriesQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-textSecondary">
                    <th className="pb-2">FM</th>
                    <th className="pb-2">Quantity (kg)</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Delivered</th>
                    <th className="pb-2">Note</th>
                    <th className="pb-2">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deliveriesQuery.data.map((delivery) => (
                    <tr key={delivery.id} className="text-sm">
                      <td className="py-2">
                        <Link href={`/facility-managers/${delivery.fm_id}`} className="text-primary hover:underline">
                          {delivery.fm_profiles?.full_name || 'Unknown'}
                        </Link>
                        <div className="text-xs text-textSecondary">{delivery.fm_profiles?.email}</div>
                      </td>
                      <td className="py-2 font-mono">{delivery.quantity_kg.toLocaleString()} kg</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          delivery.status === 'completed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30'
                            : delivery.status === 'ongoing'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800'
                        }`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 max-w-xs truncate">{delivery.note || '—'}</td>
                      <td className="py-2">
                        {delivery.proof_url ? (
                          <a href={delivery.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                            View
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-textSecondary">No deliveries recorded</div>
          )}
        </div>

        {/* Record Delivery Dialog */}
        {showDeliveryForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeliveryForm(false)}>
            <div className="card p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-4">Record Delivery</h2>
              
              <form onSubmit={handleSubmitDelivery} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select FM *</label>
                  {fmsQuery.isLoading ? (
                    <div className="text-textSecondary text-sm">Loading FMs...</div>
                  ) : (
                    <select
                      value={formData.fmId}
                      onChange={(e) => setFormData({ ...formData, fmId: e.target.value })}
                      required
                      className="input w-full"
                    >
                      <option value="">-- Select FM --</option>
                      {fmsQuery.data?.map((fm) => (
                        <option key={fm.id} value={fm.id}>
                          {fm.full_name} ({fm.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Quantity (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantityKg}
                    onChange={(e) => setFormData({ ...formData, quantityKg: e.target.value })}
                    required
                    min="0"
                    className="input w-full"
                    placeholder="e.g., 500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                    className="input w-full"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Proof URL (optional)</label>
                  <input
                    type="url"
                    value={formData.proofUrl}
                    onChange={(e) => setFormData({ ...formData, proofUrl: e.target.value })}
                    className="input w-full"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-textSecondary mt-1">Link to delivery receipt or photo</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Note (optional)</label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="input w-full"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeliveryForm(false)}
                    className="px-4 py-2 bg-surfaceMuted hover:bg-surfaceHover rounded-control"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordDeliveryMutation.isPending}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-control disabled:opacity-50"
                  >
                    {recordDeliveryMutation.isPending ? 'Recording...' : 'Record Delivery'}
                  </button>
                </div>

                {recordDeliveryMutation.error && (
                  <div className="text-red-500 text-sm">
                    {recordDeliveryMutation.error instanceof Error ? recordDeliveryMutation.error.message : 'Failed to record delivery'}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
