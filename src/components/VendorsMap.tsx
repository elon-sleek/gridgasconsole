'use client';

/**
 * Phase 8 & 9.5: Vendors Map Component
 * 
 * Displays approved gas vendor plants as markers on a map.
 */

import { useEffect, useRef, useState } from 'react';

type Vendor = {
  id: string;
  name: string;
  plant_location?: string | null;
  plant_lat?: number | null;
  plant_lng?: number | null;
  capacity_kg?: number | null;
  verified_at?: string | null;
};

interface VendorsMapProps {
  vendors: Vendor[];
  selectedVendorId?: string;
  onVendorSelect?: (vendorId: string) => void;
  className?: string;
}

export default function VendorsMap({
  vendors,
  selectedVendorId,
  onVendorSelect,
  className = '',
}: VendorsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Filter vendors with valid coordinates
  const mappableVendors = vendors.filter(
    (v) => v.plant_lat != null && v.plant_lng != null && 
           !isNaN(v.plant_lat!) && !isNaN(v.plant_lng!)
  );

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
        
        // Calculate center from vendors
        let center = defaultCenter;
        if (mappableVendors.length > 0) {
          const avgLat = mappableVendors.reduce((sum, v) => sum + (v.plant_lat ?? 0), 0) / mappableVendors.length;
          const avgLng = mappableVendors.reduce((sum, v) => sum + (v.plant_lng ?? 0), 0) / mappableVendors.length;
          center = [avgLat, avgLng];
        }

        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: 11,
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

  // Update markers when vendors change
  useEffect(() => {
    if (!mapRef.current) return;

    const L = leafletRef.current;
    if (!L) return;

    // Remove old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Vendor marker icon (gas station)
    const defaultIcon = L.divIcon({
      className: 'vendor-marker',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          background: #f97316;
          border: 3px solid white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    const selectedIcon = L.divIcon({
      className: 'vendor-marker-selected',
      html: `
        <div style="
          width: 44px;
          height: 44px;
          background: #dc2626;
          border: 4px solid white;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -44],
    });

    const markers: any[] = [];
    mappableVendors.forEach((vendor) => {
      const isSelected = vendor.id === selectedVendorId;
      const marker = L.marker([vendor.plant_lat!, vendor.plant_lng!], {
        icon: isSelected ? selectedIcon : defaultIcon,
      });

      marker.bindPopup(`
        <div style="min-width: 160px; padding: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${vendor.name}</div>
          <div style="font-size: 12px; color: #666;">
            ${vendor.plant_location ?? 'Gas Plant'}
          </div>
          ${vendor.capacity_kg != null ? `
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              Capacity: ${vendor.capacity_kg.toLocaleString()} kg
            </div>
          ` : ''}
          ${vendor.verified_at ? `
            <div style="font-size: 11px; color: #22c55e; margin-top: 4px;">
              ✓ Verified ${new Date(vendor.verified_at).toLocaleDateString()}
            </div>
          ` : ''}
        </div>
      `);

      marker.on('click', () => {
        if (onVendorSelect) {
          onVendorSelect(vendor.id);
        }
      });

      marker.addTo(mapRef.current);
      markers.push(marker);
    });

    markersRef.current = markers;

    // Fit bounds if multiple vendors
    if (mappableVendors.length > 1) {
      const bounds = L.latLngBounds(
        mappableVendors.map((v) => [v.plant_lat!, v.plant_lng!])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mappableVendors, selectedVendorId]);

  if (mappableVendors.length === 0) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-textSecondary p-8">
          <div className="text-lg font-medium mb-2">No Vendor Locations</div>
          <div className="text-sm">Vendors need coordinates to appear on the map.</div>
          <div className="text-xs mt-2 opacity-70">Set coordinates when approving vendors.</div>
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
    </div>
  );
}
