import type { GasStation } from '@/types/stations';

type OsmElement = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};

function mappedText(tags: Record<string, unknown>, key: string) {
  return typeof tags[key] === 'string' ? tags[key].trim() : '';
}

export function stationFromOsm(value: unknown): GasStation | null {
  if (!value || typeof value !== 'object') return null;
  const element = value as OsmElement;
  if (!['node', 'way', 'relation'].includes(String(element.type)) ||
    !Number.isSafeInteger(element.id) || !element.tags || typeof element.tags !== 'object' ||
    element.tags.amenity !== 'fuel') return null;

  const position = element.type === 'node' ? element : element.center;
  const latitude = position?.lat;
  const longitude = position?.lon;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;

  const tags = element.tags;
  const street = [mappedText(tags, 'addr:housenumber'), mappedText(tags, 'addr:street')].filter(Boolean).join(' ');
  return {
    id: `osm-${element.type}-${element.id}`,
    name: (mappedText(tags, 'name') || mappedText(tags, 'brand') || mappedText(tags, 'operator') || 'Name not listed').slice(0, 120),
    brand: mappedText(tags, 'brand').slice(0, 120),
    latitude,
    longitude,
    address: street || 'Address not mapped',
    city: mappedText(tags, 'addr:city').slice(0, 100),
    state: mappedText(tags, 'addr:state').slice(0, 100),
    zipCode: mappedText(tags, 'addr:postcode').slice(0, 20),
    prices: [],
    attributions: [{ provider: '© OpenStreetMap contributors', providerUri: 'https://www.openstreetmap.org/copyright' }],
  };
}

export function parseOverpassStations(value: unknown): GasStation[] {
  if (typeof value !== 'object' || value === null || !('elements' in value) || !Array.isArray(value.elements)) {
    throw new Error('The map service returned invalid station data.');
  }
  if ('remark' in value && typeof value.remark === 'string' && value.remark.length > 0) {
    throw new Error('The map service is busy. Try again shortly.');
  }
  const stations = value.elements.map((item: unknown) => stationFromOsm(item)).filter((item: GasStation | null): item is GasStation => item !== null);
  return [...new Map(stations.map((station: GasStation) => [station.id, station])).values()];
}
