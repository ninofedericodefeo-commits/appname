import { prepareStations } from '@/features/stations/logic';
import type { StationSearch } from '@/features/stations/logic';
import { parseOverpassStations } from '@/features/stations/overpassParse';

const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

export async function fetchOpenStreetMapStations(search: StationSearch, signal: AbortSignal) {
  if (!Number.isFinite(search.latitude) || Math.abs(search.latitude) > 90 ||
    !Number.isFinite(search.longitude) || Math.abs(search.longitude) > 180) {
    throw new Error('Your location is invalid. Try locating again.');
  }
  const radiusMeters = Math.round(Math.min(25, Math.max(1, search.radius)) * 1609.344);
  const query = `[out:json][timeout:15];nwr["amenity"="fuel"](around:${radiusMeters},${search.latitude.toFixed(6)},${search.longitude.toFixed(6)});out center;`;
  let lastError: unknown;

  for (const endpoint of endpoints) {
    if (signal.aborted) throw new Error('Station search cancelled.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 20_000);
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Map service unavailable (${response.status}).`);
      const payload: unknown = await response.json();
      return { stations: prepareStations(parseOverpassStations(payload), search).slice(0, 200), provider: 'OpenStreetMap' };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not reach the map service.');
}
