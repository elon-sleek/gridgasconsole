'use client';

/**
 * Phase 7.13: Buildings Map Component
 * 
 * Leaflet-based map showing all buildings with their coordinates.
 * Uses dynamic import to prevent SSR issues with Leaflet.
 */

import { useEffect, useRef, useState } from 'react';

type Building = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  apartment_count?: number;
  tenant_count?: number;
};

interface BuildingMapProps {
  buildings: Building[];
  selectedBuildingId?: string;
  onBuildingSelect?: (buildingId: string) => void;
  className?: string;
}

export default function BuildingMap({
  buildings,
  selectedBuildingId,
  onBuildingSelect,
  className = '',
}: BuildingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Filter buildings with valid coordinates
  const mappableBuildings = buildings.filter(
    (b) => b.latitude !== null && b.longitude !== null && 
           !isNaN(b.latitude!) && !isNaN(b.longitude!)
  );

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    const initMap = async () => {
      try {
        // Check if window is available (client-side)
        if (typeof window === 'undefined') return;

        // Dynamic imports
        const L = (await import('leaflet')).default;
        leafletRef.current = L;

        if (!mapContainerRef.current) return;

        // Prevent reinitializing
        if (mapRef.current) {
          mapRef.current.remove();
        }

        // Default center (Lagos, Nigeria)
        const defaultCenter: [number, number] = [6.5244, 3.3792];
        
        // Calculate center from buildings
        let center = defaultCenter;
        if (mappableBuildings.length > 0) {
          const avgLat = mappableBuildings.reduce((sum, b) => sum + (b.latitude ?? 0), 0) / mappableBuildings.length;
          const avgLng = mappableBuildings.reduce((sum, b) => sum + (b.longitude ?? 0), 0) / mappableBuildings.length;
          center = [avgLat, avgLng];
        }

        // Create map
        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: 12,
          scrollWheelZoom: true,
        });

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Custom marker icon
        const defaultIcon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: #2563eb;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L3 9v13h18V9l-9-7zm0 2.5L19 11v10H5V11l7-6.5z"/>
              </svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const selectedIcon = L.divIcon({
          className: 'custom-marker-selected',
          html: `
            <div style="
              width: 40px;
              height: 40px;
              background: #dc2626;
              border: 4px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              animation: pulse 2s infinite;
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L3 9v13h18V9l-9-7zm0 2.5L19 11v10H5V11l7-6.5z"/>
              </svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });

        // Add markers for each building
        const markers: any[] = [];
        mappableBuildings.forEach((building) => {
          const isSelected = building.id === selectedBuildingId;
          const marker = L.marker([building.latitude!, building.longitude!], {
            icon: isSelected ? selectedIcon : defaultIcon,
          });

          // Add popup
          marker.bindPopup(`
            <div style="min-width: 150px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${building.address}</div>
              <div style="font-size: 12px; color: #666;">
                ${building.tenant_count ?? 0} tenants • ${building.apartment_count ?? 0} units
              </div>
            </div>
          `);

          // Click handler
          marker.on('click', () => {
            if (onBuildingSelect) {
              onBuildingSelect(building.id);
            }
          });

          marker.addTo(map);
          markers.push(marker);
        });

        markersRef.current = markers;

        // Fit bounds if multiple buildings
        if (mappableBuildings.length > 1) {
          const bounds = L.latLngBounds(
            mappableBuildings.map((b) => [b.latitude!, b.longitude!])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        mapRef.current = map;
        setIsMapReady(true);
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

    // Cleanup
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when buildings or selection changes
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Remove old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Re-add markers with updated selection
    const L = leafletRef.current;
    if (!L) return;
    
    const defaultIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L3 9v13h18V9l-9-7zm0 2.5L19 11v10H5V11l7-6.5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    const selectedIcon = L.divIcon({
      className: 'custom-marker-selected',
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #dc2626;
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L3 9v13h18V9l-9-7zm0 2.5L19 11v10H5V11l7-6.5z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });

    const markers: any[] = [];
    mappableBuildings.forEach((building) => {
      const isSelected = building.id === selectedBuildingId;
      const marker = L.marker([building.latitude!, building.longitude!], {
        icon: isSelected ? selectedIcon : defaultIcon,
      });

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${building.address}</div>
          <div style="font-size: 12px; color: #666;">
            ${building.tenant_count ?? 0} tenants • ${building.apartment_count ?? 0} units
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onBuildingSelect) {
          onBuildingSelect(building.id);
        }
      });

      marker.addTo(mapRef.current);
      markers.push(marker);
    });

    markersRef.current = markers;
  }, [mappableBuildings, selectedBuildingId, isMapReady]);

  if (mappableBuildings.length === 0) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-textSecondary p-8">
          <div className="text-lg font-medium mb-2">No Map Data</div>
          <div className="text-sm">Buildings need coordinates to appear on the map.</div>
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
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
