import type { FuelType } from '../../types/stations.ts';
import { detourEconomics } from '../stations/tripReview.ts';

/** Preview-only data deliberately has no map coordinates or real GasStation shape. */
export type SampleStation = {
  id: `sample-station-${string}`;
  isSample: true;
  name: string;
  address: string;
  distanceMiles: number;
  hours: string;
  amenities: string[];
  prices: Record<FuelType, number>;
  history: { day: string; regular: number }[];
  refill: { date: string; gallons: number; pricePerGallon: number; totalCents: number };
};

export function sampleStations(visible = true): SampleStation[] {
  if (!visible) return [];
  return [
    {
      id: 'sample-station-river', isSample: true, name: 'River Road Fuel', address: '101 River Road · Sample town',
      distanceMiles: 0.8, hours: 'Open 24 hours', amenities: ['Restrooms', 'Convenience store', 'Air pump'],
      prices: { regular: 3.159, midgrade: 3.559, premium: 3.959, diesel: 3.699 },
      history: [{ day: 'Today', regular: 3.159 }, { day: 'Yesterday', regular: 3.199 }, { day: '3 days ago', regular: 3.259 }],
      refill: { date: 'Oct 15, 2026', gallons: 10, pricePerGallon: 3.199, totalCents: 3199 },
    },
    {
      id: 'sample-station-park', isSample: true, name: 'Parkside Service', address: '42 Park Avenue · Sample town',
      distanceMiles: 1.4, hours: '6 AM–11 PM', amenities: ['Restrooms', 'Car wash', 'Convenience store'],
      prices: { regular: 3.259, midgrade: 3.659, premium: 4.059, diesel: 3.799 },
      history: [{ day: 'Today', regular: 3.259 }, { day: 'Yesterday', regular: 3.279 }, { day: '3 days ago', regular: 3.299 }],
      refill: { date: 'Oct 10, 2026', gallons: 12, pricePerGallon: 3.299, totalCents: 3959 },
    },
    {
      id: 'sample-station-hill', isSample: true, name: 'Hilltop Market & Fuel', address: '8 Hill Street · Sample town',
      distanceMiles: 2.1, hours: 'Open 24 hours', amenities: ['Convenience store', 'Air pump', 'Accessible restroom'],
      prices: { regular: 3.359, midgrade: 3.759, premium: 4.159, diesel: 3.899 },
      history: [{ day: 'Today', regular: 3.359 }, { day: 'Yesterday', regular: 3.399 }, { day: '3 days ago', regular: 3.429 }],
      refill: { date: 'Oct 4, 2026', gallons: 11, pricePerGallon: 3.429, totalCents: 3772 },
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
