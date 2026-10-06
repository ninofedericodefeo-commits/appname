import { useQuery } from '@tanstack/react-query';

import { demoStations, fetchOnlineStations } from '@/features/stations/data';
import { fetchOpenStreetMapStations } from '@/features/stations/overpass';
import type { FuelType, SortOption } from '@/types/stations';

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
  const firstRadius = Math.min(radius, 2);
  const needsExpansion = radius > firstRadius;
  const first = useQuery({
    queryKey: ['osm-stations', latitude, longitude, firstRadius],
    enabled: mode === 'nearby' && hasLocation,
    retry: false,
    staleTime: 15 * 60_000,
    queryFn: ({ signal }) => fetchOpenStreetMapStations({ latitude: latitude!, longitude: longitude!, radius: firstRadius, fuelType, sortOrder }, signal),
  });
  const expanded = useQuery({
    queryKey: ['osm-stations', latitude, longitude, radius],
    enabled: mode === 'nearby' && hasLocation && needsExpansion && (first.isSuccess || first.isError),
    retry: false,
    staleTime: 15 * 60_000,
    queryFn: ({ signal }) => fetchOpenStreetMapStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal),
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

  if (mode !== 'nearby') return {
    data: other.data,
    isLoading: other.isLoading,
    isFetching: other.isFetching,
    isError: other.isError,
    error: other.error,
    isPartial: false,
    expansionFailed: false,
    refetch: other.refetch,
  };

  const data = needsExpansion ? expanded.data ?? first.data : first.data;
  return {
    data,
    isLoading: !data && (first.isFetching || expanded.isFetching),
    isFetching: first.isFetching || expanded.isFetching,
    isError: !data && (needsExpansion ? expanded.isError : first.isError),
    error: expanded.error ?? first.error,
    isPartial: needsExpansion && !expanded.data && !!first.data,
    expansionFailed: needsExpansion && expanded.isError && !!first.data,
    refetch: needsExpansion ? expanded.refetch : first.refetch,
  };
}
