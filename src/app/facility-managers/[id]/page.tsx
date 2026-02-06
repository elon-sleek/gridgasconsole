'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { authedFetch } from '@/lib/api';

interface FMProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: 'active' | 'blocked' | 'pending';
  created_at: string;
  updated_at: string;
}

interface Building {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  fm_id: string;
  created_at: string;
}

interface Tenant {
  id: string;
  full_name?: string;
  email?: string;
  customer_id?: string;
  meter_number?: string;
  claim_status: string;
  claimed_by_fm_id?: string;
  created_at: string;
}

interface Asset {
  id: string;
  asset_type: string;
  serial_number?: string;
  meter_number?: string;
  assigned_at: string;
}

interface VendorDelivery {
  id: string;
  vendor_id: string;
  fm_id: string;
  quantity_kg: number;
  delivered_at?: string;
  status: string;
  gas_vendors?: { name: string };
}

type SupportTicket = {
  id: string;
  ticket_id: string;
  status: string;
  priority: string;
  subject: string;
  tenant_id: string;
  created_at: string;
  tenant: {
    full_name: string;
    customer_id: string;
  } | null;
};

const OVERDUE_AFTER_DAYS = 3;

function ageInDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function isOverdue(ticket: SupportTicket): boolean {
  const active = ticket.status === 'open' || ticket.status === 'in_progress';
  return active && ageInDays(ticket.created_at) >= OVERDUE_AFTER_DAYS;
}

export default function FMDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const fmId = params.id as string;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch FM profile
  const fmQuery = useQuery({
    queryKey: ['fm_profile', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/facility-managers/${encodeURIComponent(fmId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load facility manager');
      return json?.fm as FMProfile;
    }
  });

  // Fetch FM's buildings
  const buildingsQuery = useQuery({
    queryKey: ['fm_buildings', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/buildings?fmId=${encodeURIComponent(fmId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load buildings');
      return (json?.buildings ?? []) as Building[];
    }
  });

  // Fetch FM's tenants
  const tenantsQuery = useQuery({
    queryKey: ['fm_tenants', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/tenants?claimedByFmId=${encodeURIComponent(fmId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load tenants');
      return (json?.tenants ?? []) as Tenant[];
    }
  });

  // Fetch FM's assets
  const assetsQuery = useQuery({
    queryKey: ['fm_assets', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/asset-assignments?fmId=${encodeURIComponent(fmId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load assets');
      const rows = (json?.assignments ?? []) as any[];
      return rows.map((a) => {
        const asset = a?.assets ?? null;
        return {
          ...a,
          assets: asset
            ? {
                ...asset,
                asset_type: asset.type ?? asset.asset_type ?? null,
                serial_number: asset.serial ?? asset.serial_number ?? null,
                meter_number: asset.meter_number ?? null,
              }
            : null,
        };
      });
    }
  });

  // Fetch FM's vendor deliveries
  const deliveriesQuery = useQuery({
    queryKey: ['fm_deliveries', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/vendor-deliveries?fmId=${encodeURIComponent(fmId)}&limit=20`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load deliveries');
      return (json?.deliveries ?? []) as VendorDelivery[];
    }
  });

  // Fetch FM's support tickets
  const supportTicketsQuery = useQuery({
    queryKey: ['fm_support_tickets', fmId],
    enabled: !!fmId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/support-tickets?fmId=${encodeURIComponent(fmId)}&limit=50`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load support tickets');
      return (json?.tickets ?? []) as SupportTicket[];
    },
  });

  // Status mutation (block/unblock)
  const statusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'blocked') => {
      const response = await fetch(`/api/admin/facility-managers/${fmId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fm_profile', fmId] });
    }
  });

  // Lock all meters mutation
  const lockMetersMutation = useMutation({
    mutationFn: async (action: 'lock' | 'unlock') => {
      setActionLoading(action);
      const response = await fetch(`/api/admin/facility-managers/${fmId}/${action}-meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} meters`);
      }
      return response.json();
    },
    onSuccess: () => {
      setActionLoading(null);
    },
    onError: () => {
      setActionLoading(null);
    }
  });

  const fm = fmQuery.data ?? null;

  // Count tenants in each building
  const buildingTenantCounts = new Map<string, number>();
  if (tenantsQuery.data) {
    tenantsQuery.data.forEach(tenant => {
      // Note: tenant_profiles may need building_id field
      // For now, this is a placeholder
    });
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {fmQuery.isLoading && (
          <div className="card p-5">
            <div className="text-textSecondary">Loading FM details...</div>
          </div>
        )}

        {fmQuery.error && (
          <div className="card p-5">
            <div className="text-red-500">
              Error: {fmQuery.error instanceof Error ? fmQuery.error.message : 'Failed to load FM'}
            </div>
            <Link href="/facility-managers" className="text-primary hover:underline mt-4 inline-block">
              ← Back to FMs
            </Link>
          </div>
        )}

        {fm && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
        <div>
          <Link href="/facility-managers" className="text-primary hover:underline mb-2 inline-block text-sm">
            ← Back to Facility Managers
          </Link>
          <h1 className="text-2xl font-bold">{fm.full_name}</h1>
          <p className="text-textSecondary text-sm">{fm.email}</p>
        </div>
        <div className="flex gap-2">
          {fm.status === 'active' ? (
            <button
              onClick={() => statusMutation.mutate('blocked')}
              disabled={statusMutation.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-control disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Blocking...' : 'Block FM'}
            </button>
          ) : (
            <button
              onClick={() => statusMutation.mutate('active')}
              disabled={statusMutation.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-control disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Unblocking...' : 'Unblock FM'}
            </button>
          )}
          <button
            onClick={() => lockMetersMutation.mutate('lock')}
            disabled={lockMetersMutation.isPending}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-control disabled:opacity-50"
          >
            {actionLoading === 'lock' ? 'Locking...' : 'Lock All Meters'}
          </button>
          <button
            onClick={() => lockMetersMutation.mutate('unlock')}
            disabled={lockMetersMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-control disabled:opacity-50"
          >
            {actionLoading === 'unlock' ? 'Unlocking...' : 'Unlock All Meters'}
          </button>
        </div>
      </div>

      {/* FM Profile Card */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-textSecondary">Full Name</div>
            <div className="font-medium">{fm.full_name}</div>
          </div>
          <div>
            <div className="text-sm text-textSecondary">Email</div>
            <div className="font-medium">{fm.email}</div>
          </div>
          {fm.phone && (
            <div>
              <div className="text-sm text-textSecondary">Phone</div>
              <div className="font-medium">{fm.phone}</div>
            </div>
          )}
          <div>
            <div className="text-sm text-textSecondary">Status</div>
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              fm.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
              fm.status === 'blocked' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}>
              {fm.status}
            </span>
          </div>
          <div>
            <div className="text-sm text-textSecondary">Created At</div>
            <div className="font-medium">{new Date(fm.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-textSecondary">User ID</div>
            <div className="font-medium font-mono text-xs">{fm.user_id}</div>
          </div>
        </div>
      </div>

      {/* Buildings */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Buildings ({buildingsQuery.data?.length || 0})</h2>
        {buildingsQuery.isLoading ? (
          <div className="text-textSecondary">Loading buildings...</div>
        ) : buildingsQuery.error ? (
          <div className="text-red-500 text-sm">Error loading buildings</div>
        ) : buildingsQuery.data && buildingsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {buildingsQuery.data.map(building => (
              <Link
                key={building.id}
                href={`/buildings/${building.id}`}
                className="block p-4 border rounded-lg hover:bg-surfaceHover transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{building.address}</div>
                    {(((building as any).lat ?? building.latitude) != null || ((building as any).lng ?? building.longitude) != null) && (
                      <div className="text-sm text-textSecondary mt-1">
                        Coordinates: {(building as any).lat ?? building.latitude}, {(building as any).lng ?? building.longitude}
                      </div>
                    )}
                    <div className="text-xs text-textSecondary mt-1">
                      Added: {new Date(building.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {building.photo_url && (
                    <img src={building.photo_url} alt="Building" className="w-16 h-16 rounded object-cover ml-4" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-textSecondary">No buildings registered</div>
        )}
      </div>

      {/* Tenants/Customers */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Customers/Tenants ({tenantsQuery.data?.length || 0})</h2>
        {tenantsQuery.isLoading ? (
          <div className="text-textSecondary">Loading tenants...</div>
        ) : tenantsQuery.error ? (
          <div className="text-red-500 text-sm">Error loading tenants</div>
        ) : tenantsQuery.data && tenantsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-textSecondary">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Customer ID</th>
                  <th className="pb-2">Meter Number</th>
                  <th className="pb-2">Claim Status</th>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenantsQuery.data.map(tenant => (
                  <tr key={tenant.id} className="text-sm">
                    <td className="py-2">{tenant.full_name || tenant.email || '—'}</td>
                    <td className="py-2 font-mono text-xs">{tenant.customer_id || '—'}</td>
                    <td className="py-2 font-mono text-xs">{tenant.meter_number || '—'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tenant.claim_status === 'claimed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800'
                      }`}>
                        {tenant.claim_status}
                      </span>
                    </td>
                    <td className="py-2">{new Date(tenant.created_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      <Link href={`/customers/${tenant.id}`} className="text-primary hover:underline text-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-textSecondary">No tenants claimed</div>
        )}
      </div>

      {/* Assets */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Assigned Assets ({assetsQuery.data?.length || 0})</h2>
        {assetsQuery.isLoading ? (
          <div className="text-textSecondary">Loading assets...</div>
        ) : assetsQuery.error ? (
          <div className="text-red-500 text-sm">Error loading assets</div>
        ) : assetsQuery.data && assetsQuery.data.length > 0 ? (
          <div className="space-y-2">
            {assetsQuery.data.map(assignment => {
              const asset = assignment.assets;
              return (
                <Link
                  key={assignment.id}
                  href={`/assets/${assignment.asset_id}`}
                  className="block p-3 border rounded hover:bg-surfaceHover transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium capitalize">{asset?.asset_type || 'Unknown'}</div>
                      <div className="text-sm text-textSecondary">
                        {asset?.meter_number ? `Meter #${asset.meter_number}` : asset?.serial_number || 'No serial'}
                      </div>
                    </div>
                    <div className="text-xs text-textSecondary">
                      Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-textSecondary">No assets assigned</div>
        )}
      </div>

      {/* Vendor Deliveries */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Gas Deliveries (Last 20)</h2>
        {deliveriesQuery.isLoading ? (
          <div className="text-textSecondary">Loading deliveries...</div>
        ) : deliveriesQuery.error ? (
          <div className="text-red-500 text-sm">Error loading deliveries</div>
        ) : deliveriesQuery.data && deliveriesQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-textSecondary">
                  <th className="pb-2">Vendor</th>
                  <th className="pb-2">Quantity (kg)</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Delivered At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveriesQuery.data.map(delivery => (
                  <tr key={delivery.id} className="text-sm">
                    <td className="py-2">{delivery.gas_vendors?.name || 'Unknown'}</td>
                    <td className="py-2 font-mono">{delivery.quantity_kg} kg</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        delivery.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30' :
                        delivery.status === 'ongoing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800'
                      }`}>
                        {delivery.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : '—'}
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

      {/* Support Tickets - Placeholder */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Support Tickets</h2>
        {supportTicketsQuery.isLoading ? (
          <div className="text-textSecondary">Loading tickets...</div>
        ) : supportTicketsQuery.error ? (
          <div className="text-red-500 text-sm">Error loading tickets</div>
        ) : (supportTicketsQuery.data?.length ?? 0) === 0 ? (
          <div className="text-textSecondary">No tickets assigned to this FM</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-textSecondary">
                  <th className="pb-2">Ticket ID</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Priority</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supportTicketsQuery.data!.map((ticket) => {
                  const overdue = isOverdue(ticket);
                  const ticketAgeDays = ageInDays(ticket.created_at);
                  return (
                    <tr
                      key={ticket.id}
                      className={overdue ? 'bg-red-50 dark:bg-red-900/10' : ''}
                    >
                      <td className="py-2 text-sm">
                        <Link
                          href={`/support/${ticket.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {ticket.ticket_id}
                        </Link>
                      </td>
                      <td className="py-2 text-sm font-medium">{ticket.subject}</td>
                      <td className="py-2 text-sm">
                        {ticket.tenant ? (
                          <div>
                            <div>{ticket.tenant.full_name}</div>
                            <div className="text-xs text-textSecondary">{ticket.tenant.customer_id}</div>
                          </div>
                        ) : (
                          <span className="text-textSecondary">—</span>
                        )}
                      </td>
                      <td className="py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800">
                            {ticket.status.replace('_', ' ')}
                          </span>
                          {overdue ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800">
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-textSecondary">
                        <div>{new Date(ticket.created_at).toLocaleDateString()}</div>
                        <div className="text-xs">{ticketAgeDays}d old</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
          </>
      )}
      </div>
    </ProtectedRoute>
  );
}
