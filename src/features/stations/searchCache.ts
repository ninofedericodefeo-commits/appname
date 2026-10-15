import type { GasStation } from '../../types/stations.ts';
import { areaKey, validPoint } from '../location/areaSearch.ts';
import type { AreaPoint, PlaceMatch, SearchArea } from '../location/areaSearch.ts';
import { milesBetween } from './logic.ts';

export type StationCache = AreaPoint & { radius: number; fetchedAt: string; stations: GasStation[] };
export type PlaceCache = { query: string; fetchedAt: string; matches: PlaceMatch[] };
type StationResult = { stations: GasStation[]; provider: string; fetchedAt: string };
export function stationResults(first: StationResult | undefined, expanded: StationResult | undefined, cached: StationCache | null, point: AreaPoint, radius: number) {
  const firstRadius = Math.min(radius, 2);
  if (expanded) return { data: expanded, coveredRadius: radius, isCached: false, fetchedAt: expanded.fetchedAt };
  if (first && radius <= firstRadius) return { data: first, coveredRadius: radius, isCached: false, fetchedAt: first.fetchedAt };
  if (cached && (!first || cached.radius > firstRadius)) {
    const older = first ? cached.stations.filter(station => milesBetween(station, point) > firstRadius) : cached.stations;
    const merged = new Map(older.map(station => [station.id, station]));
    first?.stations.forEach(station => merged.set(station.id, station));
    return { data: { stations: [...merged.values()], provider: 'OpenStreetMap' }, coveredRadius: Math.min(radius, cached.radius), isCached: true, fetchedAt: cached.fetchedAt };
  }
  return { data: first, coveredRadius: firstRadius, isCached: false, fetchedAt: first?.fetchedAt ?? null };
}
export function rememberArea(recent: SearchArea[], area: SearchArea) {
  if (!validPoint(area) || !area.label.trim() || area.kind === 'gps') return recent;
  return [{ ...area, label: area.label.slice(0, 300) }, ...recent.filter(item => areaKey(item) !== areaKey(area))].slice(0, 5);
}
export function rememberStations(previous: StationCache[], next: StationCache) {
  if (!validPoint(next) || !Number.isFinite(next.radius) || next.radius < 1 || next.radius > 25 || !Number.isFinite(Date.parse(next.fetchedAt))) return previous;
  const key = `${areaKey(next)}:${next.radius}`;
  return [{ ...next, stations: next.stations.slice(0, 200) }, ...previous.filter(item => `${areaKey(item)}:${item.radius}` !== key)].slice(0, 6);
}
export function cachedStations(caches: StationCache[], point: AreaPoint, radius: number) {
  const sameArea = caches.filter(item => areaKey(item) === areaKey(point) && Number.isFinite(Date.parse(item.fetchedAt)) && Date.parse(item.fetchedAt) <= Date.now() + 5 * 60_000);
  const covering = sameArea.filter(item => item.radius >= radius).sort((a, b) => a.radius - b.radius);
  return covering[0] ?? sameArea.sort((a, b) => b.radius - a.radius)[0] ?? null;
}
export function toggleFavorite(previous: GasStation[], station: GasStation) {
  if (previous.some(item => item.id === station.id)) return previous.filter(item => item.id !== station.id);
  if (!validPoint(station) || previous.length >= 50) return previous;
  // Save identity/location only. Deleting a local report must not leave a copied price behind.
  return [...previous, { ...station, prices: [], distanceMiles: undefined }];
}
