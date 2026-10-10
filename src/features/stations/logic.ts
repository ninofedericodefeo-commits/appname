import type { FuelType, GasPrice, GasStation, SortOption } from '@/types/stations';

export type StationSearch = { latitude: number; longitude: number; radius: number; fuelType: FuelType; sortOrder: SortOption };
type Coordinates = Pick<StationSearch, 'latitude' | 'longitude'>;

export function milesBetween(a: Coordinates, b: Coordinates) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const arc = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function selectedPrice(station: GasStation, fuelType: FuelType) {
  return station.prices.find((price) => price.fuelType === fuelType)?.price ?? Number.POSITIVE_INFINITY;
}

export function filterPricedStations(stations: GasStation[], fuelType: FuelType, hideUnpriced: boolean) {
  return hideUnpriced ? stations.filter((station) => {
    const price = selectedPrice(station, fuelType);
    return Number.isFinite(price) && price > 0;
  }) : stations;
}

export function prepareStations(stations: GasStation[], search: StationSearch) {
  return stations
    .map((station) => ({ ...station, distanceMiles: milesBetween(search, station) }))
    .filter((station) => station.distanceMiles <= search.radius)
    .sort((a, b) => search.sortOrder === 'distance'
      ? a.distanceMiles - b.distanceMiles
      : selectedPrice(a, search.fuelType) - selectedPrice(b, search.fuelType) || a.distanceMiles - b.distanceMiles);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

function isPrice(value: unknown): value is GasPrice {
  if (!isRecord(value)) return false;
  return ['regular', 'midgrade', 'premium', 'diesel'].includes(String(value.fuelType)) &&
    typeof value.price === 'number' && Number.isFinite(value.price) && value.price > 0 &&
    value.currency === 'USD' && typeof value.reportedAt === 'string' &&
    Number.isFinite(Date.parse(value.reportedAt)) && typeof value.source === 'string' && value.source.length > 0;
}

function isStation(value: unknown): value is GasStation {
  if (!isRecord(value)) return false;
  const validAttributions = value.attributions === undefined ||
    (Array.isArray(value.attributions) && value.attributions.every((item: unknown) =>
      isRecord(item) && typeof item.provider === 'string' && item.provider.length > 0 &&
      (item.providerUri === undefined || (typeof item.providerUri === 'string' && /^https?:\/\//i.test(item.providerUri)))));
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && value.name.length > 0 &&
    typeof value.address === 'string' && typeof value.city === 'string' && typeof value.state === 'string' &&
    isCoordinate(value.latitude, 90) && isCoordinate(value.longitude, 180) &&
    Array.isArray(value.prices) && value.prices.every(isPrice) && validAttributions;
}

export function parseStationsResponse(value: unknown): GasStation[] {
  if (!isRecord(value) || !Array.isArray(value.stations) || !value.stations.every(isStation)) {
    throw new Error('The station service returned invalid data.');
  }
  if (new Set(value.stations.map((station: GasStation) => station.id)).size !== value.stations.length) {
    throw new Error('The station service returned duplicate stations.');
  }
  return value.stations;
}

export function priceDescription(price: GasPrice | undefined, isDemo: boolean, now = Date.now()) {
  if (!price) return 'Price unavailable';
  if (isDemo && price.source === 'sample') return 'Fictional sample price';
  if (isDemo) return 'Unverified community report';
  const ageMinutes = Math.floor((now - Date.parse(price.reportedAt)) / 60_000);
  if (!Number.isFinite(ageMinutes)) return `Price age unknown · ${price.source}`;
  if (ageMinutes < -5) return `Price time unavailable · ${price.source}`;
  const displayedAge = Math.max(0, ageMinutes);
  if (displayedAge >= 24 * 60) return `Stale price · ${Math.floor(displayedAge / (24 * 60))}d old · ${price.source}`;
  if (displayedAge >= 60) return `Reported ${Math.floor(displayedAge / 60)}h ago · ${price.source}`;
  return `Reported ${displayedAge}m ago · ${price.source}`;
}

export function formatFuelPrice(price: number) {
  return `$${price.toFixed(3).replace(/(\.\d{2})0$/, '$1')}`;
}
