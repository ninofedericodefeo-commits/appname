import type { FuelType } from '@/types/stations';

export type LocalPriceReport = {
  id: string;
  stationId?: string;
  stationName: string;
  stationAddress: string;
  latitude: number;
  longitude: number;
  locationSource: 'map' | 'device' | 'entered';
  fuelType: FuelType;
  price: number;
  reportedAt: string;
};
