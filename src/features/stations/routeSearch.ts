import { Platform } from 'react-native';

import { parseOverpassStations } from '@/features/stations/overpassParse';
import { overpassEndpoints } from '@/features/stations/overpass';
import { parseDestinationInput, parseDriveRoute, routeQueryPoints } from '@/features/stations/routeLogic';
import type { DriveRoute, RoutePoint } from '@/features/stations/routeLogic';
import type { GasStation } from '@/types/stations';

async function fetchJsonWithTimeout(url: string, signal: AbortSignal, timeoutMs: number, body?: string) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(body ? { method: 'POST', headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(Platform.OS === 'web' ? {} : { 'User-Agent': 'GasFinder/1.0 (com.anonymous.gasfinder)' }),
      }, body } : {}),
    });
    if (!response.ok) throw new Error(`Service unavailable (${response.status}).`);
    return await response.json() as unknown;
  } catch (error) {
    if (timedOut && !signal.aborted) throw new Error('The public map service timed out. Try again later.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export async function fetchDriveRoute(start: RoutePoint, destination: RoutePoint, signal: AbortSignal): Promise<DriveRoute> {
  const coordinates = `${start.longitude.toFixed(6)},${start.latitude.toFixed(6)};${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`;
  const payload = await fetchJsonWithTimeout(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, signal, 20_000);
  return parseDriveRoute(payload);
}

export async function fetchStationsAlongRoute(points: RoutePoint[], signal: AbortSignal): Promise<GasStation[]> {
  const coordinates = routeQueryPoints(points).map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join(',');
  const query = `[out:json][timeout:20];nwr["amenity"="fuel"](around:2400,${coordinates});out center;`;
  let lastError: unknown;
  for (const endpoint of overpassEndpoints) {
    try {
      // Large route corridors can be rejected in a query URL. Overpass supports form-encoded POST queries.
      const payload = await fetchJsonWithTimeout(endpoint, signal, endpoint.includes('private.coffee') ? 12_000 : 25_000, `data=${encodeURIComponent(query)}`);
      return parseOverpassStations(payload);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not find stations along the route.');
}

export async function resolveMapsDestination(input: string, signal: AbortSignal) {
  const parsed = parseDestinationInput(input);
  if (!/^https?:\/\//i.test(parsed)) return parsed;
  const url = new URL(parsed);
  if (!['maps.app.goo.gl', 'goo.gl', 'maps.apple'].includes(url.hostname)) {
    throw new Error('This Maps link does not contain a readable destination. Share the destination place, or paste its address.');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const destination = parseDestinationInput(response.url);
    if (destination && !/^https?:\/\//i.test(destination)) return destination;
    throw new Error('Could not expand this Maps link. In Maps, copy the destination address instead.');
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error('Could not read this Maps link. Copy the destination address or coordinates instead.');
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
