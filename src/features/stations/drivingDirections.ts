import { parseDriveRoute } from './routeLogic.ts';
import type { DriveRoute, RoutePoint } from './routeLogic.ts';
import { fetchMapJson, serviceFailure } from './publicMapRequest.ts';

const endpoints = ['https://router.project-osrm.org/route/v1/driving', 'https://routing.openstreetmap.de/routed-car/route/v1/driving'];
const cache = new Map<string, { expires: number; route: DriveRoute }>();
let lastRequest = 0;
let queue = Promise.resolve();

function ensureActive(signal: AbortSignal) {
  // React Native's AbortSignal supports aborted/events, without throwIfAborted().
  if (signal.aborted) throw new Error('Trip changed.');
}

function waitForSlot(signal: AbortSignal) {
  const slot = queue.catch(() => {}).then(async () => {
    ensureActive(signal);
    const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (delay) await new Promise<void>((resolve, reject) => {
      const done = () => { signal.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(done, delay);
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Trip changed.')); };
      signal.addEventListener('abort', abort);
    });
    ensureActive(signal); lastRequest = Date.now();
  });
  queue = slot;
  return slot;
}

export async function fetchDrivingRoute(start: RoutePoint, destination: RoutePoint, signal: AbortSignal, nativeHeaders: boolean): Promise<DriveRoute> {
  const coordinates = `${start.longitude.toFixed(6)},${start.latitude.toFixed(6)};${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`;
  ensureActive(signal);
  const saved = cache.get(coordinates);
  if (saved && saved.expires > Date.now()) return saved.route;
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      await waitForSlot(signal);
      const payload = await fetchMapJson(`${endpoint}/${coordinates}?overview=full&geometries=geojson&steps=false&generate_hints=false`, signal, 15_000, nativeHeaders);
      if ((payload as { code?: string })?.code === 'NoRoute') throw new Error('No driving route connects these locations. Check the destination.');
      const route = parseDriveRoute(payload);
      if (cache.size >= 5) cache.delete(cache.keys().next().value!);
      cache.set(coordinates, { expires: Date.now() + 5 * 60_000, route });
      return route;
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.message.startsWith('No driving route connects'))) throw error;
      lastError = error;
    }
  }
  throw serviceFailure('Driving route lookup', lastError);
}
