import { Platform } from 'react-native';

import { prepareStations } from '@/features/stations/logic';
import type { StationSearch } from '@/features/stations/logic';
import { parseOverpassStations } from '@/features/stations/overpassParse';

export const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export async function fetchOpenStreetMapStations(search: StationSearch, signal: AbortSignal) {
  if (!Number.isFinite(search.latitude) || Math.abs(search.latitude) > 90 ||
    !Number.isFinite(search.longitude) || Math.abs(search.longitude) > 180) {
    throw new Error('Your location is invalid. Try locating again.');
  }
  const radiusMeters = Math.round(Math.min(25, Math.max(1, search.radius)) * 1609.344);
  const query = `[out:json][timeout:15];nwr["amenity"="fuel"](around:${radiusMeters},${search.latitude.toFixed(6)},${search.longitude.toFixed(6)});out center;`;
  let lastError: unknown;

  for (const endpoint of overpassEndpoints) {
    if (signal.aborted) throw new Error('Station search cancelled.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; abort(); }, endpoint.includes('private.coffee') ? 12_000 : 20_000);
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(Platform.OS === 'web' ? {} : { 'User-Agent': 'GasFinder/1.0 (com.anonymous.gasfinder)' }) },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`Map service unavailable (${response.status}).`);
      const payload: unknown = await response.json();
      return { stations: prepareStations(parseOverpassStations(payload), search).slice(0, 200), provider: 'OpenStreetMap' };
    } catch (error) {
      lastError = timedOut && !signal.aborted ? new Error('The map service timed out.') : error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not reach the map service.');
}
