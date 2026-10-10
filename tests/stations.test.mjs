import assert from 'node:assert/strict';
import test from 'node:test';

import { filterPricedStations, parseStationsResponse, prepareStations, priceDescription } from '../src/features/stations/logic.ts';

const reportedAt = '2026-09-28T12:00:00Z';
const closeStation = { id: 'close', name: 'Close', latitude: 39.9526, longitude: -75.1652, address: '1 A St', city: 'Philadelphia', state: 'PA', prices: [{ fuelType: 'regular', price: 3.6, currency: 'USD', reportedAt, source: 'Test source' }] };
const cheapStation = { ...closeStation, id: 'cheap', name: 'Cheap', longitude: -75.18, prices: [{ ...closeStation.prices[0], price: 3.1 }] };

test('The saved-price filter uses the selected fuel, rejects invalid prices and preserves ordering', () => {
  const missing = { ...closeStation, id: 'missing', prices: [] };
  const diesel = { ...closeStation, id: 'diesel', prices: [{ ...closeStation.prices[0], fuelType: 'diesel' }] };
  const invalid = { ...closeStation, id: 'invalid', prices: [{ ...closeStation.prices[0], price: 0 }] };
  const stations = [cheapStation, missing, diesel, closeStation, invalid];
  assert.equal(filterPricedStations(stations, 'regular', false), stations);
  assert.deepEqual(filterPricedStations(stations, 'regular', true).map((item) => item.id), ['cheap', 'close']);
  assert.deepEqual(filterPricedStations(stations, 'diesel', true).map((item) => item.id), ['diesel']);
  assert.deepEqual(filterPricedStations([missing], 'premium', true), []);
});

test('station response rejects malformed prices and duplicate identities', () => {
  assert.equal(parseStationsResponse({ stations: [closeStation] }).length, 1);
  assert.throws(() => parseStationsResponse({ stations: [{ ...closeStation, prices: [{ ...closeStation.prices[0], price: null }] }] }), /invalid data/);
  assert.throws(() => parseStationsResponse({ stations: [closeStation, closeStation] }), /duplicate stations/);
});

test('distance is computed from coordinates and controls radius and sorting', () => {
  const search = { latitude: closeStation.latitude, longitude: closeStation.longitude, radius: 5, fuelType: 'regular', sortOrder: 'price' };
  assert.deepEqual(prepareStations([closeStation, cheapStation], search).map((station) => station.id), ['cheap', 'close']);
  assert.deepEqual(prepareStations([closeStation, cheapStation], { ...search, sortOrder: 'distance' }).map((station) => station.id), ['close', 'cheap']);
  assert.deepEqual(prepareStations([closeStation, cheapStation], { ...search, radius: 0.1 }).map((station) => station.id), ['close']);
});

test('price labels distinguish sample, missing, stale and future reports', () => {
  const price = closeStation.prices[0];
  const now = Date.parse('2026-09-29T14:00:00Z');
  assert.equal(priceDescription({ ...price, source: 'sample' }, true, now), 'Fictional sample price');
  assert.equal(priceDescription({ ...price, source: 'community' }, true, now), 'Unverified community report');
  assert.match(priceDescription(price, false, now), /Stale price/);
  assert.equal(priceDescription(undefined, false, now), 'Price unavailable');
  assert.match(priceDescription({ ...price, reportedAt: '2026-09-30T00:00:00Z' }, false, now), /time unavailable/);
});
