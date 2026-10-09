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

export function appleMapsTrip(destination: Destination, stops: Destination[]) {
  const url = new URL('https://maps.apple.com/directions');
  url.searchParams.set('destination', `${destination.latitude},${destination.longitude}`);
  url.searchParams.set('mode', 'driving');
  for (const stop of stops) url.searchParams.append('waypoint', `${stop.latitude},${stop.longitude}`);
  return url.toString();
}

// Mobile browsers support at most 3 waypoints. Split long plans into explicit chunks rather than dropping stops.
export function googleMapsTripSegments(destination: Destination, stops: Destination[]) {
  const destinations = [...stops, destination];
  const segments: { url: string; firstStop: number; lastStop: number; reachesDestination: boolean }[] = [];
  for (let index = 0; index < destinations.length; index += 4) {
    const chunk = destinations.slice(index, index + 4);
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('travelmode', 'driving');
    const end = chunk.at(-1)!;
    url.searchParams.set('destination', `${end.latitude},${end.longitude}`);
    // Use current position when opening each chunk, including after earlier fuel stops.
    if (chunk.length > 1) url.searchParams.set('waypoints', chunk.slice(0, -1).map((stop) => `${stop.latitude},${stop.longitude}`).join('|'));
    segments.push({ url: url.toString(), firstStop: index + 1, lastStop: Math.min(stops.length, index + chunk.length), reachesDestination: index + chunk.length === destinations.length });
  }
  return segments;
}
