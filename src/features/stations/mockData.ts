import type { GasStation } from '@/types/stations';

const now = Date.now();

function minutesAgo(minutes: number) {
  return new Date(now - minutes * 60 * 1000).toISOString();
}

export const mockStations: GasStation[] = [
  {
    id: 'station-shell-1',
    name: 'Shell',
    brand: 'Shell',
    latitude: 39.9526,
    longitude: -75.1652,
    address: '123 Market St',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19103',
    amenities: { carWash: true, convenienceStore: true, restrooms: true },
    distanceMiles: 0.8,
    prices: [
      { fuelType: 'regular', price: 3.19, currency: 'USD', reportedAt: minutesAgo(12), source: 'sample' },
      { fuelType: 'midgrade', price: 3.39, currency: 'USD', reportedAt: minutesAgo(18), source: 'sample' },
      { fuelType: 'premium', price: 3.59, currency: 'USD', reportedAt: minutesAgo(22), source: 'sample' },
      { fuelType: 'diesel', price: 3.79, currency: 'USD', reportedAt: minutesAgo(52), source: 'sample' },
    ],
  },
  {
    id: 'station-wawa-1',
    name: 'Wawa',
    brand: 'Wawa',
    latitude: 39.9535,
    longitude: -75.1622,
    address: '45 Chestnut Ave',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19106',
    amenities: { convenienceStore: true, restrooms: true },
    distanceMiles: 1.1,
    prices: [
      { fuelType: 'regular', price: 3.24, currency: 'USD', reportedAt: minutesAgo(8), source: 'sample' },
      { fuelType: 'midgrade', price: 3.44, currency: 'USD', reportedAt: minutesAgo(14), source: 'sample' },
      { fuelType: 'premium', price: 3.64, currency: 'USD', reportedAt: minutesAgo(33), source: 'sample' },
      { fuelType: 'diesel', price: 3.89, currency: 'USD', reportedAt: minutesAgo(40), source: 'sample' },
    ],
  },
  {
    id: 'station-exxon-1',
    name: 'Exxon',
    brand: 'Exxon',
    latitude: 39.9492,
    longitude: -75.1701,
    address: '88 Walnut St',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19102',
    amenities: { carWash: false, convenienceStore: true, restrooms: true },
    distanceMiles: 1.5,
    prices: [
      { fuelType: 'regular', price: 3.29, currency: 'USD', reportedAt: minutesAgo(21), source: 'sample' },
      { fuelType: 'midgrade', price: 3.49, currency: 'USD', reportedAt: minutesAgo(38), source: 'sample' },
      { fuelType: 'premium', price: 3.69, currency: 'USD', reportedAt: minutesAgo(44), source: 'sample' },
      { fuelType: 'diesel', price: 3.94, currency: 'USD', reportedAt: minutesAgo(67), source: 'sample' },
    ],
  },
  {
    id: 'station-bp-1',
    name: 'BP',
    brand: 'BP',
    latitude: 39.9457,
    longitude: -75.1576,
    address: '202 Broad St',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19107',
    amenities: { convenienceStore: true, restrooms: false },
    distanceMiles: 2.2,
    prices: [
      { fuelType: 'regular', price: 3.34, currency: 'USD', reportedAt: minutesAgo(50), source: 'sample' },
      { fuelType: 'midgrade', price: 3.54, currency: 'USD', reportedAt: minutesAgo(61), source: 'sample' },
      { fuelType: 'premium', price: 3.74, currency: 'USD', reportedAt: minutesAgo(74), source: 'sample' },
      { fuelType: 'diesel', price: 3.99, currency: 'USD', reportedAt: minutesAgo(110), source: 'sample' },
    ],
  },
];
