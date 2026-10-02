const MILES_TO_METERS = 1609.344;
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.formattedAddress',
  'places.addressComponents',
  'places.fuelOptions',
  'places.attributions',
].join(',');

const fuelTypes = {
  REGULAR_UNLEADED: 'regular',
  MIDGRADE: 'midgrade',
  PREMIUM: 'premium',
  DIESEL: 'diesel',
};

function addressPart(components, type, field = 'text') {
  return components?.find((part) => part.types?.includes(type))?.[field] ?? '';
}

function fuelPrice(record) {
  const fuelType = fuelTypes[record?.type];
  const amount = record?.price;
  if (!fuelType || amount?.currencyCode !== 'USD' || !/^\d+$/.test(String(amount.units ?? ''))) return null;
  const units = Number(amount.units);
  const nanos = amount.nanos ?? 0;
  if (!Number.isSafeInteger(units) || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1_000_000_000) return null;
  const price = units + nanos / 1_000_000_000;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(Date.parse(record.updateTime))) return null;
  return { fuelType, price, currency: 'USD', reportedAt: record.updateTime, source: 'Google Maps' };
}

export function normalizeGooglePlaces(value) {
  if (!value || !Array.isArray(value.places)) return [];
  return value.places.flatMap((place) => {
    if (!place?.id || !place?.displayName?.text || !place?.location) return [];
    const { latitude, longitude } = place.location;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    // The app currently labels USD fuel prices per gallon, so include only U.S. stations.
    if (addressPart(place.addressComponents, 'country', 'shortText') !== 'US') return [];
    const fuelPrices = Array.isArray(place.fuelOptions?.fuelPrices) ? place.fuelOptions.fuelPrices : [];
    const prices = fuelPrices.map(fuelPrice).filter(Boolean);
    const attributions = Array.isArray(place.attributions) ? place.attributions.flatMap((item) => {
      if (typeof item?.provider !== 'string' || !item.provider.trim()) return [];
      return [{ provider: item.provider.trim(), ...(typeof item.providerUri === 'string' && /^https?:\/\//i.test(item.providerUri) ? { providerUri: item.providerUri } : {}) }];
    }) : [];
    return [{
      id: `google:${place.id}`,
      name: place.displayName.text,
      latitude,
      longitude,
      address: place.formattedAddress ?? '',
      city: addressPart(place.addressComponents, 'locality'),
      state: addressPart(place.addressComponents, 'administrative_area_level_1', 'shortText'),
      zipCode: addressPart(place.addressComponents, 'postal_code'),
      prices,
      attributions,
    }];
  });
}

export async function searchGooglePlaces({ apiKey, latitude, longitude, radiusMiles, signal, fetchImpl = fetch }) {
  const response = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['gas_station'],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      regionCode: 'us',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMiles * MILES_TO_METERS,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Google Places request failed (${response.status}).`);
  return normalizeGooglePlaces(await response.json());
}
