import { useQuery } from '@tanstack/react-query';

import { demoStations, fetchLocalNearbyStations, fetchOnlineStations } from '@/features/stations/data';
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
    queryKey: ['nearby-stations', mode, latitude, longitude, radius, fuelType, sortOrder],
    enabled: mode === 'demo' || (Number.isFinite(latitude) && Number.isFinite(longitude)),
    retry: mode === 'demo' ? false : 1,
    staleTime: mode !== 'demo' ? 60_000 : undefined,
    gcTime: mode === 'online' ? 0 : undefined,
    queryFn: async ({ signal }) => mode === 'demo'
      ? { stations: await demoStations({ radius, fuelType, sortOrder }, signal), provider: 'sample' }
      : mode === 'nearby'
        ? await fetchLocalNearbyStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal)
        : await fetchOnlineStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal),
  });
}
