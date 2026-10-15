import { fetchMapJson, serviceFailure } from '../stations/publicMapRequest.ts';

export type AreaPoint = { latitude: number; longitude: number };
export type SearchArea = AreaPoint & { label: string; kind: 'gps' | 'place' | 'map' };
export type PlaceMatch = SearchArea & { kind: 'place' };
export const areaKey = (point: AreaPoint) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
export const validPoint = (point: AreaPoint) => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
export const coordinateLabel = (point: AreaPoint) => `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`;
export const placeQueryKey = (query: string) => query.trim().replace(/\s+/g, ' ').toLowerCase();

export function coordinateArea(query: string): PlaceMatch | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const point = { latitude: Number(match[1]), longitude: Number(match[2]) };
  if (!validPoint(point)) throw new Error('Latitude must be between −90 and 90, and longitude between −180 and 180.');
  return { ...point, label: coordinateLabel(point), kind: 'place' };
}

export function parsePlaceMatches(payload: unknown): PlaceMatch[] {
  if (!payload || typeof payload !== 'object' || !('features' in payload) || !Array.isArray(payload.features)) throw new Error('Place search returned an unreadable result.');
  const matches: PlaceMatch[] = [];
  for (const feature of payload.features) {
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties;
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || !properties || typeof properties !== 'object') continue;
    const point = { latitude: coordinates[1], longitude: coordinates[0] };
    if (!validPoint(point)) continue;
    const text = (key: string) => typeof properties[key] === 'string' ? properties[key].trim().slice(0, 160) : '';
    const street = [text('housenumber'), text('street')].filter(Boolean).join(' ');
    const label = [...new Set([text('name'), street, text('city'), text('state'), text('postcode'), text('country')].filter(Boolean))].join(', ').slice(0, 300);
    if (!label || matches.some(item => areaKey(item) === areaKey(point) && item.label === label)) continue;
    matches.push({ ...point, label, kind: 'place' });
    if (matches.length === 5) break;
  }
  if (payload.features.length && !matches.length) throw new Error('Place search returned no usable locations. Try coordinates instead.');
  return matches;
}

let requestQueue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0;
function waitForTurn(signal: AbortSignal, delay: number) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Place search canceled.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
    signal.addEventListener('abort', abort);
    if (signal.aborted) abort();
  });
}

// Explicit submissions only, serialized and spaced; no keystroke autocomplete or GPS bias.
export function fetchPlaceMatches(query: string, signal: AbortSignal, nativeHeaders: boolean, endpoint = 'https://photon.komoot.io/api/') {
  const request = requestQueue.catch(() => undefined).then(async () => {
    if (signal.aborted) throw new Error('Place search canceled.');
    const direct = coordinateArea(query);
    if (direct) return [direct];
    if (query.trim().length < 2 || query.trim().length > 200) throw new Error('Enter a city, ZIP or address between 2 and 200 characters.');
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Place search needs a valid HTTPS service.');
    url.searchParams.set('q', query.trim()); url.searchParams.set('limit', '5'); url.searchParams.set('lang', 'en');
    await waitForTurn(signal, Math.max(0, nextRequestAt - Date.now()));
    nextRequestAt = Date.now() + 1100;
    try { return parsePlaceMatches(await fetchMapJson(url.toString(), signal, 12_000, nativeHeaders)); }
    catch (error) { if (signal.aborted) throw error; throw serviceFailure('Place search', error); }
  });
  requestQueue = request;
  return request;
}
