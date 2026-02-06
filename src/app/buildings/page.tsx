'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { IconBuildings } from '@/components/AppIcons';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import dynamic from 'next/dynamic';
import { Map as MapIcon, List } from 'lucide-react';
import { authedFetch } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

// Dynamic import to avoid SSR issues with Leaflet
const BuildingMap = dynamic(() => import('@/components/BuildingMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[48rem] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-textSecondary">Loading map...</div>
    </div>
  ),
});

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
  fm_profiles?: {
    full_name: string;
    email: string;
  } | null;
  tenant_count?: number;
}

export default function BuildingsPage() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();

  useEffect(() => {
    const view = searchParams.get('view');
    const selected = searchParams.get('selected');
    if (view === 'map') setViewMode('map');
    if (selected) setSelectedBuildingId(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeInvalidation([
    { table: 'buildings', invalidate: [['buildings_admin'], ['vw_admin_kpis']] },
    { table: 'tenant_profiles', invalidate: [['buildings_admin'], ['vw_admin_kpis']] }
  ]);

  const buildingsQuery = useQuery({
    queryKey: ['buildings_admin'],
    queryFn: async () => {
      const res = await authedFetch('/api/admin/buildings', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load buildings');
      return (json?.buildings ?? []) as Building[];
    }
  });

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Buildings</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                All registered buildings and their details
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'map' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title="Map View"
                >
                  <MapIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="text-sm text-textSecondary">Total: {buildingsQuery.data?.length || 0}</div>
              <IconBuildings className="h-7 w-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Map View */}
        {viewMode === 'map' && buildingsQuery.data && (
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Buildings Map</h2>
            <BuildingMap
              buildings={buildingsQuery.data.map((b) => ({
                id: b.id,
                address: b.address,
                latitude: b.latitude ?? b.lat ?? null,
                longitude: b.longitude ?? b.lng ?? (b as any).long ?? (b as any).lon ?? null,
                tenant_count: b.tenant_count ?? 0,
              }))}
              selectedBuildingId={selectedBuildingId}
              onBuildingSelect={setSelectedBuildingId}
              className="h-[48rem]"
            />
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
        <div className="card p-5">
          {buildingsQuery.isLoading ? (
            <div className="text-textSecondary">Loading buildings...</div>
          ) : buildingsQuery.error ? (
            <div className="text-red-500 text-sm">
              Error: {buildingsQuery.error instanceof Error ? buildingsQuery.error.message : 'Failed to load buildings'}
            </div>
          ) : buildingsQuery.data && buildingsQuery.data.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {buildingsQuery.data.map((building) => {
                const tenantCount = building.tenant_count ?? 0;
                const lat = (building as any).lat ?? building.latitude;
                const lng = (building as any).lng ?? building.longitude;

                return (
                  <Link
                    key={building.id}
                    href={`/buildings/${building.id}`}
                    className="block border rounded-lg p-4 hover:bg-surfaceHover dark:hover:bg-dark-surfaceHover transition-colors"
                  >
                    {building.photo_url && (
                      <img
                        src={building.photo_url}
                        alt="Building"
                        className="w-full h-32 object-cover rounded mb-3"
                      />
                    )}

                    <div className="space-y-2">
                      <div>
                        <div className="font-medium text-base line-clamp-2">{building.address}</div>
                      </div>

                      {(lat != null || lng != null) && (
                        <div className="text-xs text-textSecondary">
                          Coordinates: {lat != null ? Number(lat).toFixed(6) : '—'}, {lng != null ? Number(lng).toFixed(6) : '—'}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-textSecondary">
                          Tenants: {tenantCount} {tenantCount === 1 ? 'customer' : 'customers'}
                        </span>
                        {building.fm_profiles && (
                          <span className="text-textSecondary truncate ml-2">FM: {building.fm_profiles.full_name}</span>
                        )}
                      </div>

                      <div className="text-xs text-textSecondary">
                        Added: {new Date(building.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-textSecondary text-center py-8">No buildings registered yet</div>
          )}
        </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
