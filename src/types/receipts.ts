import type { FuelType } from '@/types/stations';

export type ReceiptReport = {
  id: string;
  photoUri: string;
  stationName: string;
  stationAddress: string;
  fuelType: FuelType;
  pricePerGallon: number;
  gallons?: number;
  total?: number;
  purchasedOn: string;
  savedAt: string;
  locationSource: 'device' | 'entered';
  coordinates?: { latitude: number; longitude: number };
};
