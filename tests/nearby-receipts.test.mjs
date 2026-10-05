import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOverpassStations, stationFromOsm } from '../src/features/stations/overpassParse.ts';
import { withReceiptPrices } from '../src/features/stations/receiptPrices.ts';

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
  const updated = withReceiptPrices([station], [
    base,
    { ...base, id: 'r2', purchasedOn: '2026-10-02', pricePerGallon: 3.099 },
    { ...base, id: 'r3', stationId: undefined, purchasedOn: '2026-10-03', pricePerGallon: 0.5 },
  ]);
  assert.equal(updated[0].prices[0].price, 3.099);
  assert.equal(updated[0].prices[0].source, 'my receipt');
  assert.deepEqual(station.prices, []);
});
