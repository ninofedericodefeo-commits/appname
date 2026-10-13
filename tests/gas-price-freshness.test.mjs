import assert from 'node:assert/strict';
import test from 'node:test';
import { isRecentPrice, prepareStations, recentStationPrice, filterPricedStations } from '../src/features/stations/logic.ts';
import { withLocalPrices, stationsFromSavedLocations } from '../src/features/stations/localPrices.ts';
import { chooseStop } from '../src/features/stations/multiStopLogic.ts';

const now = Date.parse('2026-10-13T12:00:00Z');
const price = (extra = {}) => ({ fuelType: 'regular', price: 3.5, currency: 'USD', reportedAt: '2026-10-13T11:00:00Z', source: 'provider', ...extra });
const station = (id, longitude, prices = [price()]) => ({ id, name: id, latitude: 40, longitude, address: 'Main St', city: '', state: '', prices });
const report = (extra = {}) => ({ id: 'local', stationId: 'one', stationName: 'One', stationAddress: 'Main St', latitude: 40, longitude: -75, fuelType: 'regular', price: 2.9, reportedAt: '2026-10-12T10:00:00Z', ...extra });

test('Recent-price classification rejects old, missing, invalid, future and sample reports', () => {
  assert.equal(isRecentPrice(price(), now), true);
  for (const value of [undefined, price({ reportedAt: '2026-10-12T12:00:00Z' }), price({ reportedAt: '' }), price({ reportedAt: '2026-10-13T13:00:00Z' }), price({ price: 0 }), price({ source: 'sample' })]) assert.equal(isRecentPrice(value, now), false);
});

test('Price sorting ranks recent reports first; stale reports remain visible and filterable but cannot win cheapest', () => {
  const old = station('old', -75, [price({ price: 1, reportedAt: '2026-10-01T12:00:00Z' })]);
  const recent = station('recent', -75.01);
  const missing = station('missing', -75.02, []);
  const search = { latitude: 40, longitude: -75, radius: 5, fuelType: 'regular', sortOrder: 'price' };
  assert.deepEqual(prepareStations([old, recent, missing], search, now).map(row => row.id), ['recent', 'old', 'missing']);
  assert.equal(recentStationPrice(old, 'regular', now), Infinity);
  assert.deepEqual(filterPricedStations([old, recent, missing], 'regular', true).map(row => row.id), ['old', 'recent']);
});

test('The newest price wins per fuel across provider/local sources; an unknown provider time can be replaced', () => {
  const base = station('one', -75, [price(), price({ fuelType: 'diesel', price: 4 })]);
  assert.equal(withLocalPrices([base], [], [report()])[0].prices[0].price, 3.5);
  const updated = withLocalPrices([base], [], [report({ reportedAt: '2026-10-13T11:30:00Z' })])[0];
  assert.equal(updated.prices[0].price, 2.9); assert.equal(updated.prices[1].price, 4);
  const unknown = station('one', -75, [price({ reportedAt: '' })]);
  assert.equal(withLocalPrices([unknown], [], [report()])[0].prices[0].source, 'my price report');
  assert.equal(base.prices[0].price, 3.5);
});

test('A receipt saved before noon is usable immediately without inventing a future report time', () => {
  const savedAt = new Date('2026-10-13T08:00:00').toISOString();
  const receipt = { id: 'receipt', stationName: 'One', stationAddress: 'Main St', stationId: 'one', coordinates: { latitude: 40, longitude: -75 }, purchasedOn: '2026-10-13', savedAt, fuelType: 'regular', pricePerGallon: 3.2 };
  const [saved] = stationsFromSavedLocations([receipt], []);
  assert.equal(saved.prices[0].reportedAt, savedAt);
  assert.equal(isRecentPrice(saved.prices[0], Date.parse(savedAt)), true);
});

test('Drive planning cannot recommend an old cheap report over a recent priced station', () => {
  const old = { ...station('old', -75, [price({ price: 0.5, reportedAt: '2026-10-01T12:00:00Z' })]), milesAhead: 95, milesOffRoute: 0 };
  const recent = { ...station('recent', -75.01), milesAhead: 90, milesOffRoute: 1 };
  const window = { fromMiles: 0, targetMiles: 100, searchStartMiles: 75, searchEndMiles: 100, rangeMiles: 110 };
  assert.equal(chooseStop([old, recent], window, 'regular', [], now).id, 'recent');
  assert.equal(chooseStop([old], window, 'regular', [], now).id, 'old'); // Still a reachable stop; no claimed current price.
});
