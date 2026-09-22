import { useQuery } from '@tanstack/react-query';

import { mockStations } from '@/features/stations/mockData';
import type { FuelType, NearbyStationsResponse, SortOption } from '@/types/stations';

export function useNearbyStations({
  latitude,
  longitude,
  radius,
  fuelType,
  sortOrder,
}: {
  latitude: number;
  longitude: number;
  radius: number;
  fuelType: FuelType;
  sortOrder: SortOption;
}) {
  return useQuery({
    queryKey: ['nearby-stations', latitude, longitude, radius, fuelType, sortOrder],
    queryFn: async (): Promise<NearbyStationsResponse> => {
      await new Promise((resolve) => setTimeout(resolve, 350));

      const stations = mockStations
        .map((station) => ({
          ...station,
          prices: station.prices.map((price) => ({ ...price, fuelType: price.fuelType })),
        }))
        .sort((a, b) => {
          const aPrice = a.prices.find((price) => price.fuelType === fuelType)?.price ?? Number.POSITIVE_INFINITY;
          const bPrice = b.prices.find((price) => price.fuelType === fuelType)?.price ?? Number.POSITIVE_INFINITY;
          if (sortOrder === 'distance') {
            return (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY);
          }
          return aPrice - bPrice;
        });

      return {
        stations,
      };
    },
  });
}
