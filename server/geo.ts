import type { PoliceStation } from '../src/types.ts';

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildFallbackPoliceStations(lat: number, lng: number): PoliceStation[] {
  const offsets = [
    { name: 'Central Women Safety Police Outpost (Demo Reference)', dLat: 0.0082, dLng: 0.0064, addr: 'Main Junction Road, Sector 2' },
    { name: 'Metro Transit Police Station (Demo Reference)', dLat: -0.0115, dLng: 0.0091, addr: 'Transit Plaza & Station Approach' },
    { name: 'Town Law & Order Police Station (Demo Reference)', dLat: 0.0148, dLng: -0.0122, addr: 'Civic Center Avenue' },
    { name: 'Night Patrol Assistance Booth (Demo Reference)', dLat: -0.0064, dLng: -0.0085, addr: 'Commercial Market Circle' },
  ];

  return offsets
    .map((item, idx) => {
      const sLat = Number((lat + item.dLat).toFixed(5));
      const sLng = Number((lng + item.dLng).toFixed(5));
      return {
        id: `demo-ps-${idx}`,
        name: item.name,
        address: item.addr,
        lat: sLat,
        lng: sLng,
        distanceKm: Number(haversineKm(lat, lng, sLat, sLng).toFixed(2)),
        phone: undefined,
        isVerifiedSource: false,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function findNearbyPoliceStations(
  lat: number,
  lng: number,
): Promise<{ stations: PoliceStation[]; isSimulatedFallback: boolean }> {
  const query = `[out:json][timeout:10];(node["amenity"="police"](around:8000,${lat},${lng});way["amenity"="police"](around:8000,${lat},${lng}););out center 18;`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SHE-SHIELD-AI/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Overpass returned ${res.status}`);
    }

    const json = (await res.json()) as { elements?: OverpassElement[] };
    const elements = json.elements ?? [];
    const mapped: PoliceStation[] = [];

    for (const el of elements) {
      const pLat = el.lat ?? el.center?.lat;
      const pLng = el.lon ?? el.center?.lon;
      if (typeof pLat !== 'number' || typeof pLng !== 'number') continue;

      const tags = el.tags ?? {};
      const name = tags.name || tags['name:en'] || 'Police Station';
      const addressParts = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:suburb'] || tags['addr:neighbourhood'],
        tags['addr:city'],
      ].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(', ') : tags['addr:full'] || 'OpenStreetMap verified location';
      const phone = tags.phone || tags['contact:phone'] || undefined;

      mapped.push({
        id: `osm-${el.id}`,
        name,
        address,
        lat: pLat,
        lng: pLng,
        distanceKm: Number(haversineKm(lat, lng, pLat, pLng).toFixed(2)),
        phone,
        isVerifiedSource: true,
      });
    }

    if (mapped.length === 0) {
      return {
        stations: buildFallbackPoliceStations(lat, lng),
        isSimulatedFallback: true,
      };
    }

    mapped.sort((a, b) => a.distanceKm - b.distanceKm);
    return {
      stations: mapped.slice(0, 12),
      isSimulatedFallback: false,
    };
  } catch {
    return {
      stations: buildFallbackPoliceStations(lat, lng),
      isSimulatedFallback: true,
    };
  }
}

export async function searchPlaces(query: string): Promise<Array<{ displayName: string; lat: number; lng: number }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SHE-SHIELD-AI/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return data.map((item) => ({
      displayName: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  } catch {
    return [];
  }
}

export async function computeSafeRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ coordinates: [number, number][]; distanceKm: number; estimatedMinutes: number; isFallback: boolean }> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('OSRM failed');
    const data = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('Empty route');
    const coords: [number, number][] = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return {
      coordinates: coords,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      estimatedMinutes: Math.max(2, Math.round(route.duration / 60)),
      isFallback: false,
    };
  } catch {
    const dist = haversineKm(fromLat, fromLng, toLat, toLng);
    return {
      coordinates: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      distanceKm: Number(dist.toFixed(2)),
      estimatedMinutes: Math.max(4, Math.round((dist / 25) * 60)),
      isFallback: true,
    };
  }
}
