import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { demoStations, fetchOnlineStations } from '@/features/stations/data';
import { fetchOpenStreetMapStations } from '@/features/stations/overpass';
import type { FuelType, SortOption } from '@/types/stations';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { cachedStations, stationResults } from './searchCache';

export function useNearbyStations({
  mode,
  latitude,
  longitude,
  radius,
  fuelType,
  sortOrder,
}: {
  mode: 'demo' | 'nearby' | 'online';
  latitude?: number;
  longitude?: number;
  radius: number;
  fuelType: FuelType;
  sortOrder: SortOption;
}) {
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const caches = useGasSearchStore(state => state.stationCaches);
  const cached = hasLocation && mode === 'nearby' ? cachedStations(caches, { latitude: latitude!, longitude: longitude! }, radius) : null;
  async function fetchAndCache(searchRadius: number, signal: AbortSignal) {
    const result = await fetchOpenStreetMapStations({ latitude: latitude!, longitude: longitude!, radius: searchRadius, fuelType, sortOrder }, signal);
    const fetchedAt = new Date().toISOString();
    if (!signal.aborted) useGasSearchStore.getState().saveStations({ latitude: latitude!, longitude: longitude!, radius: searchRadius, fetchedAt, stations: result.stations });
    return { ...result, fetchedAt };
  }
  const firstRadius = Math.min(radius, 2);
  const needsExpansion = radius > firstRadius;
  const first = useQuery({
    queryKey: ['osm-stations', latitude, longitude, firstRadius],
    enabled: mode === 'nearby' && hasLocation,
    retry: false,
    staleTime: 15 * 60_000,
    queryFn: ({ signal }) => fetchAndCache(firstRadius, signal),
  });
  const expanded = useQuery({
    queryKey: ['osm-stations', latitude, longitude, radius],
    enabled: mode === 'nearby' && hasLocation && needsExpansion && (first.isSuccess || first.isError),
    retry: false,
    staleTime: 15 * 60_000,
    queryFn: ({ signal }) => fetchAndCache(radius, signal),
  });
  const other = useQuery({
    queryKey: ['nearby-stations', mode, latitude, longitude, radius, fuelType, sortOrder],
    enabled: mode === 'demo' || (mode === 'online' && hasLocation),
    retry: false,
    staleTime: mode === 'online' ? 60_000 : undefined,
    gcTime: mode === 'online' ? 0 : undefined,
    queryFn: async ({ signal }) => mode === 'demo'
      ? { stations: await demoStations({ radius, fuelType, sortOrder }, signal), provider: 'sample' }
      : await fetchOnlineStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal),
  });
  const resolved = useMemo(() => stationResults(first.data, needsExpansion ? expanded.data : undefined, cached, { latitude: latitude!, longitude: longitude! }, radius), [first.data, expanded.data, needsExpansion, cached, latitude, longitude, radius]);

  if (mode !== 'nearby') return {
    data: other.data,
    isLoading: other.isLoading,
    isFetching: other.isFetching,
    isError: other.isError,
    error: other.error,
    isPartial: false,
    expansionFailed: false,
    coveredRadius: radius,
    isCached: false,
    fetchedAt: other.dataUpdatedAt ? new Date(other.dataUpdatedAt).toISOString() : null,
    refreshFailed: other.isError && !!other.data,
    refetch: other.refetch,
  };

  const { data, coveredRadius } = resolved;
  const failed = needsExpansion ? expanded.isError : first.isError;
  return {
    data,
    isLoading: !data && (first.isFetching || expanded.isFetching),
    isFetching: first.isFetching || expanded.isFetching,
    isError: !data && failed,
    error: expanded.error ?? first.error,
    isPartial: !!data && coveredRadius < radius,
    expansionFailed: !!data && coveredRadius < radius && failed,
    coveredRadius: Math.min(radius, coveredRadius),
    isCached: !!data && (resolved.isCached || failed),
    fetchedAt: resolved.fetchedAt,
    refreshFailed: !!data && failed,
    refetch: needsExpansion ? expanded.refetch : first.refetch,
  };
}
