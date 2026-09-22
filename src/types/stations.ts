export type FuelType = 'regular' | 'midgrade' | 'premium' | 'diesel';
export type SortOption = 'price' | 'distance';
export type PriceFreshness = 'fresh' | 'recent' | 'stale' | 'unknown';

export type GasPrice = {
  fuelType: FuelType;
  price: number;
  currency: 'USD';
  reportedAt: string;
  source: string;
};

export type GasStation = {
  id: string;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  amenities?: {
    carWash?: boolean;
    convenienceStore?: boolean;
    restrooms?: boolean;
  };
  prices: GasPrice[];
  distanceMiles?: number;
};

export type NearbyStationsResponse = {
  stations: GasStation[];
};
