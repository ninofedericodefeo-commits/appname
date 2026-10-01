import { parseStationsResponse, prepareStations } from '@/features/stations/logic';
import type { StationSearch } from '@/features/stations/logic';

export { priceDescription } from '@/features/stations/logic';

export const demoLocation = { latitude: 39.9526, longitude: -75.1652 };
export const stationApiBaseUrl = process.env.EXPO_PUBLIC_STATIONS_API_URL?.replace(/\/$/, '') ?? '';
export const sampleApiBaseUrl = process.env.EXPO_PUBLIC_SAMPLE_API_URL?.replace(/\/$/, '') ?? '';

export function validatedSampleApiUrl() {
  if (!sampleApiBaseUrl) throw new Error('Sample station API is not configured.');
  const url = new URL(sampleApiBaseUrl);
  const host = url.hostname;
  const localHost = ['localhost', '127.0.0.1'].includes(host) || host.endsWith('.local') ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  if (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && localHost)) {
    throw new Error('Sample station API requires HTTPS or a local development address.');
  }
  return sampleApiBaseUrl;
}

export async function demoStations(search: Pick<StationSearch, 'radius' | 'fuelType' | 'sortOrder'>, signal: AbortSignal) {
  const response = await fetch(`${validatedSampleApiUrl()}/v1/stations/sample`, { signal });
  if (!response.ok) throw new Error(`Sample station API unavailable (${response.status}).`);
  const payload: unknown = await response.json();
  return prepareStations(parseStationsResponse(payload), { ...demoLocation, ...search });
}

export async function reportStationPrice(stationId: string, fuelType: string, price: number) {
  const response = await fetch(`${validatedSampleApiUrl()}/v1/stations/${encodeURIComponent(stationId)}/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fuel_type: fuelType, price }),
  });
  if (!response.ok) throw new Error(`Could not save price (${response.status}).`);
}
export async function fetchOnlineStations(search: StationSearch, signal: AbortSignal) {
  if (!stationApiBaseUrl) throw new Error('Online station search is not configured.');
  const serviceUrl = new URL(stationApiBaseUrl);
  const isLocalDevelopment = __DEV__ && serviceUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(serviceUrl.hostname);
  if (serviceUrl.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('Station service must use HTTPS outside local development.');
  }
  const url = `${stationApiBaseUrl}/v1/stations/nearby?latitude=${encodeURIComponent(search.latitude)}` +
    `&longitude=${encodeURIComponent(search.longitude)}&radiusMiles=${encodeURIComponent(search.radius)}` +
    `&fuelType=${encodeURIComponent(search.fuelType)}`;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error : `Station service unavailable (${response.status}).`;
      throw new Error(message);
    }
    const provider = typeof payload === 'object' && payload !== null && 'provider' in payload && payload.provider === 'Google Maps'
      ? 'Google Maps' : 'station provider';
    return { stations: prepareStations(parseStationsResponse(payload), search), provider };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
