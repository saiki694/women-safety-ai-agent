import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Coordinates, PoliceStation } from '../types';

interface SafetyMapProps {
  coords: Coordinates | null;
  policeStations?: PoliceStation[];
  routeCoordinates?: [number, number][];
  destination?: { lat: number; lng: number; name: string } | null;
  heightClass?: string;
}

export const SafetyMap: React.FC<SafetyMapProps> = ({
  coords,
  policeStations = [],
  routeCoordinates = [],
  destination = null,
  heightClass = 'h-[360px] md:h-[440px]',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = coords ? [coords.lat, coords.lng] : [17.4435, 78.3772];
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const boundsPoints: [number, number][] = [];

    if (coords) {
      const userPos: [number, number] = [coords.lat, coords.lng];
      boundsPoints.push(userPos);

      if (coords.accuracy && coords.accuracy > 0 && coords.accuracy < 2000) {
        L.circle(userPos, {
          radius: coords.accuracy,
          color: '#8B5CF6',
          fillColor: '#8B5CF6',
          fillOpacity: 0.14,
          weight: 1,
        }).addTo(group);
      }

      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#EF4444;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(239,68,68,0.28);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker(userPos, { icon: userIcon })
        .bindPopup(
          `<div style="font-size:12px;"><strong>Your Current Location</strong><br/>${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</div>`,
        )
        .addTo(group);
    }

    for (const station of policeStations.slice(0, 10)) {
      const pos: [number, number] = [station.lat, station.lng];
      boundsPoints.push(pos);
      const policeIcon = L.divIcon({
        className: '',
        html: `<div style="width:26px;height:26px;border-radius:8px;background:#1E293B;border:2px solid #38BDF8;color:#38BDF8;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.45);">P</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker(pos, { icon: policeIcon })
        .bindPopup(
          `<div style="font-size:12px;max-width:210px;"><strong>${station.name.replace(/</g, '&lt;')}</strong><br/><span style="color:#94a3b8;">${station.distanceKm} km away</span><br/><a href="https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}" target="_blank" rel="noopener noreferrer" style="color:#a78bfa;text-decoration:underline;">Navigate in Google Maps</a></div>`,
        )
        .addTo(group);
    }

    if (routeCoordinates.length > 1) {
      L.polyline(routeCoordinates, {
        color: '#8B5CF6',
        weight: 4,
        opacity: 0.9,
      }).addTo(group);
      for (const pt of routeCoordinates) {
        boundsPoints.push(pt);
      }
    }

    if (destination) {
      const destPos: [number, number] = [destination.lat, destination.lng];
      boundsPoints.push(destPos);
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#10B981;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(16,185,129,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(destPos, { icon: destIcon })
        .bindPopup(`<div style="font-size:12px;"><strong>Destination</strong><br/>${destination.name.replace(/</g, '&lt;')}</div>`)
        .addTo(group);
    }

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 15, { animate: true });
    } else if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [36, 36], maxZoom: 15 });
    }
  }, [coords, policeStations, routeCoordinates, destination]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0A1022] ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!coords && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-amber-500/30 bg-[#0A1022]/90 px-4 py-2.5 text-xs text-amber-200 backdrop-blur-md">
          GPS permission not yet granted. Enable location access to center the map on your live position.
        </div>
      )}
    </div>
  );
};
