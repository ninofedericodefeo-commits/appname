import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOverpassStations, stationFromOsm } from '../src/features/stations/overpassParse.ts';
import { localPriceHistory, withLocalPrices } from '../src/features/stations/localPrices.ts';

const element = {
  type: 'node', id: 123, lat: 39.95, lon: -75.16,
  tags: { amenity: 'fuel', name: 'Market Fuel', 'addr:housenumber': '10', 'addr:street': 'Main St' },
};

test('OpenStreetMap fuel elements become real station locations without invented prices', () => {
  const [station] = parseOverpassStations({ elements: [element, element, { ...element, id: 456, tags: { amenity: 'cafe' } }, null] });
  assert.equal(station.id, 'osm-node-123');
  assert.equal(station.address, '10 Main St');
  assert.deepEqual(station.prices, []);
  assert.equal(stationFromOsm({ type: 'way', id: 2, center: { lat: 39.96, lon: -75.17 }, tags: { amenity: 'fuel' } })?.id, 'osm-way-2');
  assert.equal(stationFromOsm({ type: 'way', id: 3, center: { lat: 39.96, lon: -75.17 }, tags: { amenity: 'fuel' } })?.name, 'Name not listed');
  assert.equal(stationFromOsm({ ...element, lat: 999 }), null);
});

test('the map parser treats service errors as failures', () => {
  assert.throws(() => parseOverpassStations({ elements: [], remark: 'runtime error' }), /busy/);
  assert.throws(() => parseOverpassStations({ foo: [] }), /invalid/);
});

test('only receipts explicitly linked to a station supply its local price', () => {
  const [station] = parseOverpassStations({ elements: [element] });
  const base = {
    id: 'r1', photoUri: 'local', stationName: station.name, stationAddress: station.address,
    stationId: station.id, fuelType: 'regular', pricePerGallon: 3.199,
    purchasedOn: '2026-10-01', savedAt: '2026-10-01T12:00:00Z', locationSource: 'map',
  };
  const updated = withLocalPrices([station], [
    base,
    { ...base, id: 'r2', purchasedOn: '2026-10-02', pricePerGallon: 3.099 },
    { ...base, id: 'r3', stationId: undefined, purchasedOn: '2026-10-03', pricePerGallon: 0.5 },
  ], []);
  assert.equal(updated[0].prices[0].price, 3.099);
  assert.equal(updated[0].prices[0].source, 'my receipt');
  assert.deepEqual(station.prices, []);
});

test('the newest linked local report wins; an unlinked report cannot change a mapped price', () => {
  const [station] = parseOverpassStations({ elements: [element] });
  const receipt = {
    id: 'receipt', photoUri: 'local', stationName: station.name, stationAddress: station.address,
    stationId: station.id, fuelType: 'regular', pricePerGallon: 3.499,
    purchasedOn: '2026-10-01', savedAt: '2026-10-01T12:00:00Z', locationSource: 'map',
  };
  const report = {
    id: 'price', stationId: station.id, stationName: station.name, stationAddress: station.address,
    latitude: station.latitude, longitude: station.longitude, locationSource: 'map',
    fuelType: 'regular', price: 3.299, reportedAt: '2026-10-05T12:00:00Z',
  };
  const updated = withLocalPrices([station], [receipt], [report, { ...report, id: 'unlinked', stationId: undefined, price: 0.5 }]);
  assert.equal(updated[0].prices[0].price, 3.299);
  assert.equal(updated[0].prices[0].source, 'my price report');
  assert.equal(withLocalPrices([station], [receipt], [{ ...report, reportedAt: '2026-09-30T12:00:00Z' }])[0].prices[0].price, 3.499);
  assert.deepEqual(station.prices, []);
});

test('the local graph includes linked receipts and direct reports, excluding unlinked and fictional prices', () => {
  const stationId = 'osm-node-123';
  const receipt = { id: 'r', stationId, fuelType: 'regular', pricePerGallon: 3.4, purchasedOn: '2026-10-01' };
  const report = { id: 'p', stationId, fuelType: 'regular', price: 3.2, reportedAt: '2026-10-05T12:00:00Z' };
  const points = localPriceHistory(stationId, 'regular', 7, [receipt], [report, { ...report, id: 'other', stationId: undefined, price: 9.99 }], Date.parse('2026-10-06T12:00:00Z'));
  assert.deepEqual(points.map((point) => point.price), [3.4, 3.2]);
  assert.equal(localPriceHistory(stationId, 'regular', 7, [receipt], [report], Date.parse('2026-11-06T12:00:00Z')).length, 0);
});
