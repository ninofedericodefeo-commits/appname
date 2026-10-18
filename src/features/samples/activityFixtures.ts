import type { CarProfile } from '../vehicles/logic.ts';
import type { FuelReport } from '../fuel/logic.ts';
import type { ArchivedGoal } from '../goals/logic.ts';
import { sampleTransactions } from './fixtures.ts';
import { spendingSummary } from '../insights/logic.ts';
import { fuelStatistics } from '../fuel/statistics.ts';

/** Display-only records. Never pass these to a persisted financial or driving store. */
export function sampleCars(): (CarProfile & { isSample: true })[] {
  return [{ id: 'sample-car-corolla', name: 'Sample daily driver', model: 'Toyota Corolla', mpg: 32, tankGallons: 13.2,
    estimateSource: 'Invented example profile; not a vehicle specification.', isSample: true }];
}

export function sampleFillups(): (FuelReport & { isSample: true })[] {
  return [
    { day: '04', gallons: 13, price: 3.307, totalCents: 4299, odometerMiles: 42000 },
    { day: '14', gallons: 10, price: 3.299, totalCents: 3299, odometerMiles: 42320 },
    { day: '24', gallons: 11, price: 3.259, totalCents: 3585, odometerMiles: 42661 },
  ].map((row, index) => ({ id: `sample-refill-${row.day}`, storage: 'receipt', isSample: true,
    stationId: 'sample-harbor-fuel', stationName: 'Sample Harbor Fuel', stationAddress: '100 Example Avenue · fictional address',
    price: row.price, fuelType: 'regular', priceQualifier: 'card', gallons: row.gallons, totalCents: row.totalCents,
    adjustmentCents: row.totalCents - Math.round(row.price * row.gallons * 100), odometerMiles: row.odometerMiles,
    carId: 'sample-car-corolla', fullFill: true, completeFillInterval: index > 0,
    observedAt: `2026-09-${row.day}T12:00:00.000Z`, savedAt: `2026-09-${row.day}T12:00:00.000Z`, photoUri: '' }));
}

export function sampleFuelStatistics() { return fuelStatistics(sampleFillups(), [], sampleCars()[0].id); }

export function samplePastGoals(): (ArchivedGoal & { isSample: true })[] {
  return [{ id: 'sample-past-headphones', title: 'Sample headphones', kind: 'item', targetCents: 12000, savedCents: 12000,
    deadline: null, setAsideRule: { mode: 'fixed', cents: 200 }, createdAt: '2026-08-01T12:00:00.000Z',
    endedAt: '2026-09-15T12:00:00.000Z', result: 'reached', isSample: true }];
}

export function sampleSpendingSummary() {
  const categories: Record<string, string> = { '04': 'Gas', '06': 'Groceries', '08': 'Subscriptions', '10': 'Subscriptions', '13': 'Food', '24': 'Shopping' };
  const rows = sampleTransactions().map(row => ({ ...row, details: { merchant: row.title,
    category: categories[row.sourceDate!.slice(-2)] ?? 'Income', classification: row.sourceDate!.endsWith('-20') ? 'transfer' as const : 'ordinary' as const,
    note: 'Synthetic statement example.' } }));
  return spendingSummary(rows, '2026-09-01', '2026-09-30');
}
