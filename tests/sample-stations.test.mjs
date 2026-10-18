import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStations, sampleStationById, sampleFuelPrice, sampleStationHistory, sampleStationComparison } from '../src/features/samples/stations.ts';
import { detourEconomics } from '../src/features/stations/tripReview.ts';

test('station previews are marked synthetic and cannot enter the real map or reporting model', () => {
  const stations = sampleStations();
  assert.equal(stations.length, 3);
  assert.equal(new Set(stations.map(station => station.id)).size, 3);
  for (const station of stations) {
    assert.equal(station.isSample, true);
    assert.match(station.id, /^sample-station-/);
    assert.match(station.address, /Sample town/);
    assert.equal('latitude' in station, false);
    assert.equal('longitude' in station, false);
    assert.equal('source' in station, false);
    assert.ok(station.amenities.length > 0);
    assert.equal(station.history[0].regular, station.prices.regular);
    assert.equal(station.refill.totalCents, Math.round(station.refill.gallons * station.refill.pricePerGallon * 100));
    for (const fuel of ['regular', 'midgrade', 'premium', 'diesel']) assert.ok(station.prices[fuel] > 0);
  }
});

test('hide removes every station preview and detail without mutating real records', () => {
  const real = [{ id: 'real-station', name: 'My station' }];
  const before = structuredClone(real);
  assert.deepEqual(sampleStations(false), []);
  assert.equal(sampleStationById('sample-station-river', false), undefined);
  assert.deepEqual(real, before);
  assert.deepEqual(sampleStations(), sampleStations(true));
  assert.equal(sampleStationById('real-station'), undefined);
  assert.equal(sampleStationById(['sample-station-river']), undefined);
});

test('each detail is isolated and per-gallon prices preserve the fractional cent', () => {
  const first = sampleStationById('sample-station-river');
  first.prices.regular = 99;
  first.history[0].regular = 99;
  first.amenities.push('Changed');
  const clean = sampleStationById('sample-station-river');
  assert.equal(clean.prices.regular, 3.159);
  assert.equal(clean.history[0].regular, 3.159);
  assert.equal(clean.amenities.includes('Changed'), false);
  assert.equal(sampleFuelPrice(clean.prices.regular), '$3.159');
});

test('sample chart has dated ascending reports and comparison reuses route planner economics', () => {
  const station = sampleStationById('sample-station-river');
  const history = sampleStationHistory(station);
  assert.equal(history.at(-1).price, station.prices.regular);
  assert.ok(history.every((row, index) => index === 0 || Date.parse(row.reportedAt) > Date.parse(history[index - 1].reportedAt)));
  assert.deepEqual(sampleStationComparison(station), detourEconomics(2, 30, 3.159, 10, 3.459));
  assert.equal(sampleStationComparison(station).netCents, 275);
});
