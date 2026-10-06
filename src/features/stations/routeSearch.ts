import { parseOverpassStations } from '@/features/stations/overpassParse';
import { overpassEndpoints } from '@/features/stations/overpass';
import { parseDriveRoute, routeQueryPoints } from '@/features/stations/routeLogic';
import type { DriveRoute, RoutePoint } from '@/features/stations/routeLogic';
import type { GasStation } from '@/types/stations';

async function fetchJsonWithTimeout(url: string, signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
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
      const payload = await fetchJsonWithTimeout(`${endpoint}?data=${encodeURIComponent(query)}`, signal, endpoint.includes('private.coffee') ? 12_000 : 20_000);
      return parseOverpassStations(payload);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not find stations along the route.');
}
