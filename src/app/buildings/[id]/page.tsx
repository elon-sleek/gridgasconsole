'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api';

interface Building {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  fm_id?: string;
  created_at: string;
  updated_at?: string;
}

interface Tenant {
  id: string;
  full_name?: string;
  email?: string;
  customer_id?: string;
  meter_number?: string;
  account_status?: string;
}

interface FM {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
}

interface Asset {
  id: string;
  asset_type: string;
  serial_number?: string;
  meter_number?: string;
  install_address?: string;
}

export default function BuildingDetailPage() {
  const params = useParams();
  const buildingId = params.id as string;
  const router = useRouter();
  const qc = useQueryClient();

  // Fetch building details
  const buildingQuery = useQuery({
    queryKey: ['building', buildingId],
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/buildings/${buildingId}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load building');
      return json?.building as Building;
    }
  });

  // Fetch tenants in this building
  const tenantsQuery = useQuery({
    queryKey: ['building_tenants', buildingId],
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/tenants?buildingId=${encodeURIComponent(buildingId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load tenants');
      return (json?.tenants ?? []) as Tenant[];
    }
  });

  // Fetch FM details
  const fmQuery = useQuery({
    queryKey: ['fm', buildingQuery.data?.fm_id],
    queryFn: async () => {
      if (!buildingQuery.data?.fm_id) return null;
      const res = await authedFetch(`/api/admin/facility-managers/${buildingQuery.data.fm_id}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load FM');
      return (json?.fm ?? null) as FM;
    },
    enabled: !!buildingQuery.data?.fm_id
  });

  // Fetch assets in this building
  const assetsQuery = useQuery({
    queryKey: ['building_assets', buildingId],
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/assets?buildingId=${encodeURIComponent(buildingId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load assets');

      // Normalize the API response to the local shape this page already expects.
      const rows = (json?.assets ?? []) as any[];
      return rows.map((a) => ({
        id: a.id,
        asset_type: a.type,
        serial_number: a.serial ?? undefined,
        meter_number: undefined,
        install_address: a.install_address ?? undefined,
      })) as unknown as Asset[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`/api/admin/buildings/${encodeURIComponent(buildingId)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to delete building');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buildings_admin'] });
      qc.invalidateQueries({ queryKey: ['vw_admin_kpis'] });
      alert('Building deleted successfully');
      router.push('/buildings');
    },
  });

  if (buildingQuery.isLoading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="text-textSecondary">Loading building details...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (buildingQuery.error) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="text-red-500">
            Error: {buildingQuery.error instanceof Error ? buildingQuery.error.message : 'Failed to load building'}
          </div>
          <Link href="/buildings" className="text-primary hover:underline mt-4 inline-block">
            ← Back to Buildings
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const building = buildingQuery.data!;
  const lat = (building as any).lat ?? building.latitude;
  const lng = (building as any).lng ?? (building as any).long ?? (building as any).lon ?? building.longitude;

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
          <Link href="/buildings" className="text-primary hover:underline mb-2 inline-block text-sm">
            ← Back to Buildings
          </Link>
          <h1 className="text-2xl font-bold">Building Detail</h1>
          <p className="text-textSecondary text-sm">{building.address}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              const ok = window.confirm('Delete this building? This cannot be undone.');
              if (!ok) return;
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="rounded-control border border-border dark:border-dark-border px-3 py-2 text-sm text-red-600 hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete building'}
          </button>
        </div>

        {/* Building Info */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Building Information</h2>
          
          {building.photo_url && (
            <img
              src={building.photo_url}
              alt="Building"
              className="w-full max-w-md h-48 object-cover rounded mb-4"
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-textSecondary">Address</div>
              <div className="font-medium">{building.address}</div>
            </div>

            {(lat != null || lng != null) && (
              <div className="col-span-2 flex flex-wrap gap-8">
                {lat != null && (
                  <div>
                    <div className="text-sm text-textSecondary">Latitude</div>
                    <div className="font-medium font-mono">{Number(lat).toFixed(6)}</div>
                  </div>
                )}

                {lng != null && (
                  <div>
                    <div className="text-sm text-textSecondary">Longitude</div>
                    <div className="font-medium font-mono">{Number(lng).toFixed(6)}</div>
                  </div>
                )}
              </div>
            )}

            {(lat != null && lng != null) && (
              <div className="col-span-2">
                <Link
                  href={`/buildings?view=map&selected=${encodeURIComponent(building.id)}`}
                  className="text-primary hover:underline text-sm"
                >
                  View on map →
                </Link>
              </div>
            )}

            <div>
              <div className="text-sm text-textSecondary">Created At</div>
              <div className="font-medium">{new Date(building.created_at).toLocaleString()}</div>
            </div>
            
            {building.updated_at && (
              <div>
                <div className="text-sm text-textSecondary">Updated At</div>
                <div className="font-medium">{new Date(building.updated_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Responsible FM */}
        {fmQuery.data && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-4">Responsible Facility Manager</h2>
            <Link
              href={`/facility-managers/${fmQuery.data.id}`}
              className="block border rounded-lg p-4 hover:bg-surfaceHover transition-colors"
            >
              <div className="font-medium text-base">{fmQuery.data.full_name}</div>
              <div className="text-sm text-textSecondary mt-1">{fmQuery.data.email}</div>
              {fmQuery.data.phone && (
                <div className="text-sm text-textSecondary mt-1">📞 {fmQuery.data.phone}</div>
              )}
              <div className="mt-2">
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  fmQuery.data.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}>
                  {fmQuery.data.status}
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Customers in Building */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">
            Customers ({tenantsQuery.data?.length || 0})
          </h2>
          
          {tenantsQuery.isLoading ? (
            <div className="text-textSecondary">Loading customers...</div>
          ) : tenantsQuery.error ? (
            <div className="text-red-500 text-sm">Error loading customers</div>
          ) : tenantsQuery.data && tenantsQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-textSecondary">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Customer ID</th>
                    <th className="pb-2">Meter Number</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenantsQuery.data.map((tenant) => (
                    <tr key={tenant.id} className="text-sm">
                      <td className="py-2">{tenant.full_name || tenant.email || '—'}</td>
                      <td className="py-2 font-mono text-xs">{tenant.customer_id || '—'}</td>
                      <td className="py-2 font-mono text-xs">{tenant.meter_number || '—'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tenant.account_status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800'
                        }`}>
                          {tenant.account_status || 'unknown'}
                        </span>
                      </td>
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
            <div className="text-textSecondary">No customers in this building</div>
          )}
        </div>

        {/* Assets in Building */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">
            Assets ({assetsQuery.data?.length || 0})
          </h2>
          
          {assetsQuery.isLoading ? (
            <div className="text-textSecondary">Loading assets...</div>
          ) : assetsQuery.error ? (
            <div className="text-red-500 text-sm">Error loading assets</div>
          ) : assetsQuery.data && assetsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {assetsQuery.data.map((asset) => (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}`}
                  className="block border rounded-lg p-3 hover:bg-surfaceHover transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium capitalize">{asset.asset_type}</div>
                      <div className="text-sm text-textSecondary">
                        {asset.meter_number ? `Meter #${asset.meter_number}` : asset.serial_number || 'No serial'}
                      </div>
                      {asset.install_address && (
                        <div className="text-xs text-textSecondary mt-1">
                          📍 {asset.install_address}
                        </div>
                      )}
                    </div>
                    <div className="text-primary text-sm">View →</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-textSecondary">No assets in this building</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
