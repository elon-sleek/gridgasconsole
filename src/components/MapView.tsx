'use client';

import { useEffect, useRef } from 'react';

interface Marker {
  id: string;
  position: [number, number];
  address: string;
  fmName: string;
  tenantCount: number;
}

interface MapViewProps {
  markers: Marker[];
}

export default function MapView({ markers }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;

      // Fix for default marker icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const map = L.map(mapRef.current).setView([9.082, 8.6753], 6); // Nigeria center

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);

        // Invalidate size after mount to avoid blank tiles when the container was not fully sized.
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore
          }
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;
      if (!mapInstanceRef.current || !markersLayerRef.current) return;

      markersLayerRef.current.clearLayers();

      if (markers.length === 0) return;

      const bounds = L.latLngBounds([]);

      markers.forEach((marker) => {
        const customIcon = L.divIcon({
          html: `<div style="background-color: ${marker.tenantCount > 0 ? '#16a34a' : '#9ca3af'}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker(marker.position, { icon: customIcon })
          .bindPopup(
            `
            <div style="min-width: 200px;">
              <div style="font-weight: 600; margin-bottom: 8px;">${marker.address}</div>
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                FM: ${marker.fmName}
              </div>
              <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
                Customers: ${marker.tenantCount}
              </div>
              <a href="/buildings/${marker.id}" style="color: #2563eb; text-decoration: underline; font-size: 13px;">
                View Details →
              </a>
            </div>
          `
          )
          .addTo(markersLayerRef.current);

        bounds.extend(marker.position);
      });

      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    });

    return () => {
      cancelled = true;
    };
  }, [markers]);

  return (
    <div 
      ref={mapRef} 
      className="h-[600px] w-full rounded-lg"
      style={{ zIndex: 0 }}
    />
  );
}
