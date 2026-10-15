export type PriceQualifier = 'standard' | 'cash' | 'card' | 'member';
export type FuelPurchaseDetails = {
  priceQualifier?: PriceQualifier;
  observedAt?: string;
  gallons?: number;
  totalCents?: number;
  adjustmentCents?: number;
  carId?: string;
  odometerMiles?: number;
  fullFill?: boolean;
  completeFillInterval?: boolean;
  accountLink?: { kind: 'transaction' | 'purchase'; id: string };
  trashedAt?: string;
};
