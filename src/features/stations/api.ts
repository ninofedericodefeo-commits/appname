import type { FuelType, GasStation, NearbyStationsResponse } from '@/types/stations';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

function getApiUrl() {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured. Add it to your .env.local file.');
  }

  return `${apiBaseUrl}/stations/nearby`;
}

function isGasStation(value: unknown): value is GasStation {
  if (!value || typeof value !== 'object') return false;

  const station = value as Partial<GasStation>;
  return (
    typeof station.id === 'string' &&
    typeof station.name === 'string' &&
    typeof station.latitude === 'number' &&
    typeof station.longitude === 'number' &&
    typeof station.address === 'string' &&
    typeof station.city === 'string' &&
    typeof station.state === 'string' &&
    Array.isArray(station.prices)
  );
}

function parseStations(payload: unknown): NearbyStationsResponse {
  const stations = payload && typeof payload === 'object' && 'stations' in payload ? payload.stations : payload;

  if (!Array.isArray(stations) || !stations.every(isGasStation)) {
    throw new Error('The stations API returned an invalid response.');
  }

  return { stations };
}

export async function fetchNearbyStations({
  latitude,
  longitude,
  radius,
  fuelType,
}: {
  latitude: number;
  longitude: number;
  radius: number;
  fuelType: FuelType;
}): Promise<NearbyStationsResponse> {
  const query = [
    `lat=${encodeURIComponent(latitude)}`,
    `lng=${encodeURIComponent(longitude)}`,
    `radiusMiles=${encodeURIComponent(radius)}`,
    `fuelType=${encodeURIComponent(fuelType)}`,
  ].join('&');

  const response = await fetch(`${getApiUrl()}?${query}`);
  if (!response.ok) {
    throw new Error(`The stations API returned HTTP ${response.status}.`);
  }

  return parseStations(await response.json());
}
