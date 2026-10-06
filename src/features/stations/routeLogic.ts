import type { GasStation } from '@/types/stations';

export type RoutePoint = { latitude: number; longitude: number };
export type DriveRoute = { points: RoutePoint[]; miles: number; minutes: number };
export type RouteStation = GasStation & { milesAhead: number; milesOffRoute: number };

export function parseDriveRoute(payload: unknown): DriveRoute {
  if (!payload || typeof payload !== 'object' || !('routes' in payload) || !Array.isArray(payload.routes)) throw new Error('The route service returned invalid data.');
  const route = payload.routes[0];
  if (!route || typeof route !== 'object' || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) ||
    route.distance < 0 || route.duration < 0 ||
    !route.geometry || !Array.isArray(route.geometry.coordinates)) throw new Error('No driving route was found.');
  const points: RoutePoint[] = route.geometry.coordinates.map((pair: unknown) => {
    if (!Array.isArray(pair) || pair.length < 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[1]) > 90 || Math.abs(pair[0]) > 180) {
      throw new Error('The route service returned invalid coordinates.');
    }
    return { latitude: pair[1], longitude: pair[0] };
  });
  if (points.length < 2) throw new Error('No driving route was found.');
  return { points, miles: route.distance / 1609.344, minutes: route.duration / 60 };
}

function projected(point: RoutePoint, referenceLatitude: number) {
  return { x: point.longitude * 69.172 * Math.cos(referenceLatitude * Math.PI / 180), y: point.latitude * 69.0 };
}

function segmentDistance(point: RoutePoint, start: RoutePoint, end: RoutePoint) {
  const latitude = point.latitude;
  const p = projected(point, latitude);
  const a = projected(start, latitude);
  const b = projected(end, latitude);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = dx * dx + dy * dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return { miles: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), fraction: t, segmentMiles: Math.hypot(dx, dy) };
}

export function routeProximity(point: RoutePoint, path: RoutePoint[]) {
  if (path.length < 2) return { miles: Number.POSITIVE_INFINITY, fraction: 0 };
  let closest = Number.POSITIVE_INFINITY;
  let along = 0;
  let distanceSoFar = 0;
  let total = 0;
  const segments = [];
  for (let index = 1; index < path.length; index++) {
    const result = segmentDistance(point, path[index - 1], path[index]);
    segments.push(result);
    total += result.segmentMiles;
  }
  for (const segment of segments) {
    if (segment.miles < closest) {
      closest = segment.miles;
      along = distanceSoFar + segment.fraction * segment.segmentMiles;
    }
    distanceSoFar += segment.segmentMiles;
  }
  return { miles: closest, fraction: total > 0 ? along / total : 0 };
}

export function routePrefix(points: RoutePoint[], maxMiles: number) {
  if (points.length < 2) return points;
  const result = [points[0]];
  let traveled = 0;
  for (let index = 1; index < points.length; index++) {
    const segment = segmentDistance(points[index], points[index - 1], points[index]).segmentMiles;
    if (traveled + segment > maxMiles) {
      const part = Math.max(0, (maxMiles - traveled) / segment);
      result.push({ latitude: points[index - 1].latitude + (points[index].latitude - points[index - 1].latitude) * part,
        longitude: points[index - 1].longitude + (points[index].longitude - points[index - 1].longitude) * part });
      return result;
    }
    result.push(points[index]);
    traveled += segment;
  }
  return result;
}

export function routeQueryPoints(points: RoutePoint[], maxPoints = 100) {
  if (points.length <= maxPoints) return points;
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const length = segmentDistance(points[index], points[index - 1], points[index]).segmentMiles;
    lengths.push(length);
    total += length;
  }
  const chosen = [points[0]];
  let segmentIndex = 0;
  let distanceBeforeSegment = 0;
  for (let index = 1; index < maxPoints - 1; index++) {
    const target = total * index / (maxPoints - 1);
    while (segmentIndex < lengths.length - 1 && distanceBeforeSegment + lengths[segmentIndex] < target) {
      distanceBeforeSegment += lengths[segmentIndex];
      segmentIndex++;
    }
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const fraction = lengths[segmentIndex] > 0 ? (target - distanceBeforeSegment) / lengths[segmentIndex] : 0;
    chosen.push({ latitude: start.latitude + (end.latitude - start.latitude) * fraction,
      longitude: start.longitude + (end.longitude - start.longitude) * fraction });
  }
  chosen.push(points.at(-1)!);
  return chosen;
}

export function stationsOnRoute(stations: GasStation[], points: RoutePoint[], lookaheadMiles: number): RouteStation[] {
  return stations.map((station) => {
    const proximity = routeProximity(station, points);
    return { ...station, milesAhead: proximity.fraction * lookaheadMiles, milesOffRoute: proximity.miles };
  }).filter((station) => station.milesOffRoute <= 1 && station.milesAhead >= 0)
    .sort((a, b) => a.milesAhead - b.milesAhead);
}

export function parseDestinationInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!['maps.apple.com', 'www.google.com', 'google.com', 'maps.google.com'].includes(url.hostname)) return trimmed;
    const fromQuery = url.searchParams.get('destination') || url.searchParams.get('daddr') || url.searchParams.get('coordinate') || url.searchParams.get('q') || url.searchParams.get('query');
    if (fromQuery) return fromQuery;
    const embeddedCoordinates = url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (embeddedCoordinates) return `${embeddedCoordinates[1]},${embeddedCoordinates[2]}`;
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function parseCoordinateDestination(value: string): RoutePoint | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
