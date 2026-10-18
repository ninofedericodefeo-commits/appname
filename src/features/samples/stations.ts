import type { FuelType } from '../../types/stations.ts';
import { detourEconomics } from '../stations/tripReview.ts';

/** Real public locations with explicitly synthetic prices; never stored as live GasStation records. */
export type SampleStation = {
  id: `sample-station-${string}`;
  isSample: true;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  locality: string;
  locationSourceUrl: `https://${string}`;
  locationVerifiedOn: string;
  prices: Record<FuelType, number>;
  history: { day: string; regular: number }[];
  refill: { date: string; gallons: number; pricePerGallon: number; totalCents: number };
};

export function sampleStations(visible = true): SampleStation[] {
  if (!visible) return [];
  return [
    {
      id: 'sample-station-river', isSample: true, name: 'Sunoco · Haddonfield', address: '515 Haddon Ave, Haddonfield, NJ 08033',
      latitude: 39.90359, longitude: -75.04012, locality: 'Haddonfield',
      locationSourceUrl: 'https://www.sunoco.com/locations/store/515-haddon-ave-haddonfield-nj-0004657308', locationVerifiedOn: '2026-10-18',
      prices: { regular: 3.159, midgrade: 3.559, premium: 3.959, diesel: 3.699 },
      history: [{ day: 'Today', regular: 3.159 }, { day: 'Yesterday', regular: 3.199 }, { day: '3 days ago', regular: 3.259 }],
      refill: { date: 'Oct 15, 2026', gallons: 10, pricePerGallon: 3.199, totalCents: 3199 },
    },
    {
      id: 'sample-station-park', isSample: true, name: 'Sunoco · Kings Highway', address: '1605 N Kings Hwy, Cherry Hill, NJ 08034',
      latitude: 39.91604, longitude: -75.00771, locality: 'Cherry Hill · near Haddonfield',
      locationSourceUrl: 'https://www.sunoco.com/locations/store/1605-n-kings-hwy-cherry-hill-nj-0697019801', locationVerifiedOn: '2026-10-18',
      prices: { regular: 3.259, midgrade: 3.659, premium: 4.059, diesel: 3.799 },
      history: [{ day: 'Today', regular: 3.259 }, { day: 'Yesterday', regular: 3.279 }, { day: '3 days ago', regular: 3.299 }],
      refill: { date: 'Oct 10, 2026', gallons: 12, pricePerGallon: 3.299, totalCents: 3959 },
    },

  ];
}

export function sampleStationById(id: unknown, visible = true): SampleStation | undefined {
  return typeof id === 'string' ? sampleStations(visible).find(station => station.id === id) : undefined;
}

export function sampleFuelPrice(price: number): string {
  return `$${price.toFixed(3)}`;
}

export function sampleStationHistory(station: SampleStation) {
  const dates = ['2026-10-18T12:00:00Z', '2026-10-17T12:00:00Z', '2026-10-15T12:00:00Z'];
  return station.history.map((point, index) => ({ id: index + 1, price: point.regular, reportedAt: dates[index] })).reverse();
}

export function sampleStationComparison(station: SampleStation) {
  // Match the route planner's calculation, using only explicit fictional assumptions.
  return detourEconomics(2, 30, station.prices.regular, 10, 3.459)!;
}

/** Map projection stays separate from station search, report, favorite and price caches. */
export function sampleStationPins(visible = true, fuelType: FuelType = 'regular') {
  return sampleStations(visible).map(station => ({
    id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude,
    price: station.prices[fuelType], sample: true,
  }));
}
