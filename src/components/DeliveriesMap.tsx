'use client';

/**
 * Phase 9.1 & 9.5: Deliveries Map Component
 * 
 * Displays:
 * - Live FM locations as animated markers
 * - Vendor plants as static markers
 * - Floating tiles with delivery details on click
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authedFetch } from '@/lib/api';

type FMLocation = {
  fm_id: string;
  delivery_batch_id: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
  fm_profiles?: { full_name: string } | null;
};

type DeliveryBatch = {
  id: string;
  fm_id: string;
  vendor_id: string | null;
  total_tanks_count: number;
  total_kg: number;
  status: string;
  fm_profiles?: { full_name: string; phone?: string | null } | null;
  gas_vendors?: { name: string } | null;
};

type Vendor = {
  id: string;
  name: string;
  plant_lat: number | null;
  plant_lng: number | null;
  capacity_kg: number | null;
};

interface DeliveriesMapProps {
  fmLocations: FMLocation[];
  activeDeliveries: DeliveryBatch[];
  className?: string;
}

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
};

export default function DeliveriesMap({
  fmLocations,
  activeDeliveries,
  className = '',
}: DeliveriesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const vendorMarkersRef = useRef<any[]>([]);
  const [selectedFM, setSelectedFM] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Fetch approved vendors for static markers
  const vendorsQuery = useQuery({
    queryKey: ['vendors_for_map'],
    queryFn: async () => {
      const res = await authedFetch('/api/admin/gas-vendors', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load vendors');
      const rows = (json?.vendors ?? []) as any[];
      return rows
        .filter((v) => v?.plant_lat != null && v?.plant_lng != null)
        .map((v) => ({
          id: String(v.id ?? ''),
          name: String(v.name ?? ''),
          plant_lat: v.plant_lat,
          plant_lng: v.plant_lng,
          capacity_kg: v.capacity_kg ?? null,
        })) as Vendor[];
    },
  });

  // Get delivery for selected FM
  const selectedDelivery = useMemo(() => {
    if (!selectedFM) return null;
    return activeDeliveries.find(d => d.fm_id === selectedFM) ?? null;
  }, [selectedFM, activeDeliveries]);

  useEffect(() => {
    const initMap = async () => {
      try {
        if (typeof window === 'undefined') return;

        const L = (await import('leaflet')).default;
        leafletRef.current = L;

        if (!mapContainerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
        }

        // Default center (Lagos, Nigeria)
        const defaultCenter: [number, number] = [6.5244, 3.3792];

        // Calculate center from FM locations
        let center = defaultCenter;
        if (fmLocations.length > 0) {
          const avgLat = fmLocations.reduce((sum, l) => sum + l.latitude, 0) / fmLocations.length;
          const avgLng = fmLocations.reduce((sum, l) => sum + l.longitude, 0) / fmLocations.length;
          center = [avgLat, avgLng];
        }

        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: 12,
          scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setError(null);

        // Fix common "gray tiles" issue when container is first shown/resized.
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore
          }
        }, 50);

        if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
          resizeObserverRef.current?.disconnect();
          resizeObserverRef.current = new ResizeObserver(() => {
            try {
              map.invalidateSize();
            } catch {
              // ignore
            }
          });
          resizeObserverRef.current.observe(mapContainerRef.current);
        }
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map. Please refresh the page.');
      }
    };

    initMap();

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update FM markers
  useEffect(() => {
    if (!mapRef.current) return;

    const L = leafletRef.current;
    if (!L) return;

    // Remove old FM markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // FM marker icon (moving truck)
    const fmIcon = L.divIcon({
      className: 'fm-marker',
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });

    fmLocations.forEach((location) => {
      const delivery = activeDeliveries.find(d => d.fm_id === location.fm_id);
      const fmName = location.fm_profiles?.full_name ?? 'Unknown FM';

      const marker = L.marker([location.latitude, location.longitude], {
        icon: fmIcon,
      });

      marker.bindPopup(`
        <div style="min-width: 180px; padding: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${fmName}</div>
          ${delivery ? `
            <div style="font-size: 12px; color: #666;">
              <div>${delivery.total_tanks_count} tanks • ${delivery.total_kg} kg</div>
              <div style="margin-top: 4px; font-weight: 500; color: #3b82f6;">
                ${statusLabels[delivery.status] ?? delivery.status}
              </div>
              ${delivery.gas_vendors?.name ? `<div style="margin-top: 2px;">→ ${delivery.gas_vendors.name}</div>` : ''}
            </div>
          ` : '<div style="font-size: 12px; color: #666;">No active delivery</div>'}
        </div>
      `);

      marker.on('click', () => {
        setSelectedFM(location.fm_id);
      });

      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, [fmLocations, activeDeliveries]);

  // Update vendor markers
  useEffect(() => {
    if (!mapRef.current || !vendorsQuery.data) return;

    const L = leafletRef.current;
    if (!L) return;

    // Remove old vendor markers
    vendorMarkersRef.current.forEach((marker) => marker.remove());
    vendorMarkersRef.current = [];

    // Vendor marker icon (gas station)
    const vendorIcon = L.divIcon({
      className: 'vendor-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #f97316;
          border: 2px solid white;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    vendorsQuery.data.forEach((vendor) => {
      if (vendor.plant_lat == null || vendor.plant_lng == null) return;

      const marker = L.marker([vendor.plant_lat, vendor.plant_lng], {
        icon: vendorIcon,
      });

      marker.bindPopup(`
        <div style="min-width: 150px; padding: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${vendor.name}</div>
          <div style="font-size: 12px; color: #666;">
            ${vendor.capacity_kg != null ? `Capacity: ${vendor.capacity_kg.toLocaleString()} kg` : 'Vendor Plant'}
          </div>
        </div>
      `);

      marker.addTo(mapRef.current);
      vendorMarkersRef.current.push(marker);
    });
  }, [vendorsQuery.data]);

  if (fmLocations.length === 0 && (vendorsQuery.data?.length ?? 0) === 0) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-textSecondary p-8">
          <div className="text-lg font-medium mb-2">No Live Deliveries</div>
          <div className="text-sm">FM locations will appear here during active deliveries.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg z-10">
          <div className="text-red-600 text-center p-4">{error}</div>
        </div>
      )}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '300px' }}
      />
      
      {/* Floating Tile for selected FM */}
      {selectedDelivery && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 max-w-xs z-[1000]">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{selectedDelivery.fm_profiles?.full_name ?? 'Unknown FM'}</div>
            <button
              onClick={() => setSelectedFM(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="text-sm text-textSecondary dark:text-dark-textSecondary space-y-1">
            <div>{selectedDelivery.total_tanks_count} tanks • {selectedDelivery.total_kg} kg</div>
            <div className="font-medium text-primary">{statusLabels[selectedDelivery.status] ?? selectedDelivery.status}</div>
            {selectedDelivery.gas_vendors?.name && (
              <div>Vendor: {selectedDelivery.gas_vendors.name}</div>
            )}
            {selectedDelivery.fm_profiles?.phone && (
              <div>📞 {selectedDelivery.fm_profiles.phone}</div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 4px 16px rgba(59, 130, 246, 0.6); }
          100% { transform: scale(1); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4); }
        }
      `}</style>
    </div>
  );
}
