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
  return useQuery({
    queryKey: ['nearby-stations', mode, latitude, longitude, radius, mode === 'nearby' ? null : fuelType, mode === 'nearby' ? null : sortOrder],
    enabled: mode === 'demo' || (Number.isFinite(latitude) && Number.isFinite(longitude)),
    retry: false,
    staleTime: mode === 'nearby' ? 15 * 60_000 : mode === 'online' ? 60_000 : undefined,
    gcTime: mode === 'online' ? 0 : undefined,
    queryFn: async ({ signal }) => mode === 'demo'
      ? { stations: await demoStations({ radius, fuelType, sortOrder }, signal), provider: 'sample' }
      : mode === 'nearby'
        ? await fetchOpenStreetMapStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal)
        : await fetchOnlineStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal),
  });
}
