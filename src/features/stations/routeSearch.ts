import { Platform } from 'react-native';
import { fetchDrivingRoute } from './drivingDirections';
import { fetchMapJson, serviceFailure } from './publicMapRequest';

import { parseOverpassStations } from '@/features/stations/overpassParse';
import { overpassEndpoints } from '@/features/stations/overpass';
import { parseDestinationInput, routeQueryPoints } from '@/features/stations/routeLogic';
import type { DriveRoute, RoutePoint } from '@/features/stations/routeLogic';
import type { GasStation } from '@/types/stations';

export async function fetchDriveRoute(start: RoutePoint, destination: RoutePoint, signal: AbortSignal): Promise<DriveRoute> {
  return fetchDrivingRoute(start, destination, signal, Platform.OS !== 'web');
}

export async function fetchStationsAlongRoute(points: RoutePoint[], signal: AbortSignal): Promise<GasStation[]> {
  const coordinates = routeQueryPoints(points).map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join(',');
  const query = `[out:json][timeout:20];nwr["amenity"="fuel"](around:2400,${coordinates});out center;`;
  let lastError: unknown;
  for (const endpoint of overpassEndpoints) {
    try {
      // Large route corridors can be rejected in a query URL. Overpass supports form-encoded POST queries.
      const payload = await fetchMapJson(endpoint, signal, endpoint.includes('private.coffee') ? 12_000 : 25_000, Platform.OS !== 'web', `data=${encodeURIComponent(query)}`);
      return parseOverpassStations(payload);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw serviceFailure('Gas station lookup', lastError);
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
