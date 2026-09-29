import { mockStations } from '@/features/stations/mockData';
import { parseStationsResponse, prepareStations } from '@/features/stations/logic';
import type { StationSearch } from '@/features/stations/logic';

export { priceDescription } from '@/features/stations/logic';

export const demoLocation = { latitude: 39.9526, longitude: -75.1652 };
export const stationApiBaseUrl = process.env.EXPO_PUBLIC_STATIONS_API_URL?.replace(/\/$/, '') ?? '';

export function demoStations(search: Pick<StationSearch, 'radius' | 'fuelType' | 'sortOrder'>) {
  return prepareStations(mockStations, { ...demoLocation, ...search });
}
export async function fetchOnlineStations(search: StationSearch, signal: AbortSignal) {
  if (!stationApiBaseUrl) throw new Error('Online station search is not configured.');
  if (!stationApiBaseUrl.startsWith('https://')) throw new Error('Station service must use HTTPS.');
  const url = `${stationApiBaseUrl}/v1/stations/nearby?latitude=${encodeURIComponent(search.latitude)}` +
    `&longitude=${encodeURIComponent(search.longitude)}&radiusMiles=${encodeURIComponent(search.radius)}` +
    `&fuelType=${encodeURIComponent(search.fuelType)}`;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Station service unavailable (${response.status}).`);
    return prepareStations(parseStationsResponse(await response.json()), search);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
