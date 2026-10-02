import type { GasStation } from '@/types/stations';

type Destination = Pick<GasStation, 'latitude' | 'longitude'>;

export function appleMapsDirections(station: Destination) {
  const destination = encodeURIComponent(`${station.latitude},${station.longitude}`);
  return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
}

export function googleMapsDirections(station: Destination) {
  const destination = encodeURIComponent(`${station.latitude},${station.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
