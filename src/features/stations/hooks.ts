import { useQuery } from '@tanstack/react-query';

import { demoStations, fetchOnlineStations } from '@/features/stations/data';
import type { FuelType, SortOption } from '@/types/stations';

export function useNearbyStations({
  mode,
  latitude,
  longitude,
  radius,
  fuelType,
  sortOrder,
}: {
  mode: 'demo' | 'online';
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
    queryFn: async ({ signal }) => ({
      stations: mode === 'demo'
        ? demoStations({ radius, fuelType, sortOrder })
        : await fetchOnlineStations({ latitude: latitude!, longitude: longitude!, radius, fuelType, sortOrder }, signal),
    }),
  });
}
