import type { FuelPurchaseDetails } from './fuelReports';
import type { FuelType } from '@/types/stations';

export type ReceiptReport = FuelPurchaseDetails & {
  id: string;
  stationId?: string;
  photoUri: string;
  stationName: string;
  stationAddress: string;
  fuelType: FuelType;
  pricePerGallon: number;
  gallons?: number;
  total?: number;
  purchasedOn: string;
  savedAt: string;
  locationSource: 'device' | 'entered' | 'map';
  coordinates?: { latitude: number; longitude: number };
};
