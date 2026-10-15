import assert from 'node:assert/strict';
import test from 'node:test';
import NativeAbortController from 'abort-controller';
import { coordinateArea, fetchPlaceMatches, parsePlaceMatches, placeQueryKey } from '../src/features/location/areaSearch.ts';
import { cachedStations, rememberArea, rememberStations, stationResults, toggleFavorite } from '../src/features/stations/searchCache.ts';
import { isRecentPrice, prepareStations } from '../src/features/stations/logic.ts';

const point = { latitude: 40, longitude: -75 };
const area = { ...point, label: 'Test city', kind: 'place' };
const feature = { geometry: { type: 'Point', coordinates: [-75, 40] }, properties: { name: 'Test city', city: 'Test city', state: 'PA', country: 'United States' } };
const station = { id: 'osm-node-1', name: 'Test fuel', address: 'Public station', city: 'Test city', state: 'PA', ...point, prices: [{ fuelType: 'regular', price: 3.5, currency: 'USD', reportedAt: '2026-01-01T12:00:00Z', source: 'report' }] };
const fetchedAt = new Date().toISOString();
const cache = { ...point, radius: 5, stations: [station], fetchedAt };

test('Coordinates work without a service and reject invalid ranges before a network request', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Should not fetch'); });
  assert.deepEqual(coordinateArea('40, -75'), { ...point, kind: 'place', label: '40.000, -75.000' });
  assert.equal(coordinateArea('Philadelphia, PA'), null);
  assert.throws(() => coordinateArea('91, -75'), /Latitude/);
  assert.throws(() => coordinateArea('40, 181'), /longitude/);
  assert.equal((await fetchPlaceMatches('40, -75', new AbortController().signal, false)).length, 1);
  await assert.rejects(fetchPlaceMatches('91, -75', new AbortController().signal, false), /Latitude/);
  assert.equal(calls, 0);
});

test('Place results preserve longitude/latitude ordering, explain ambiguity, deduplicate, and reject unusable payloads', () => {
  const matches = parsePlaceMatches({ features: [feature, feature, { ...feature, geometry: { type: 'Point', coordinates: [-74, 41] } }] });
  assert.equal(matches.length, 2); assert.equal(matches[0].latitude, 40); assert.equal(matches[0].longitude, -75);
  assert.equal(matches[0].label, 'Test city, PA, United States');
  assert.deepEqual(parsePlaceMatches({ features: [] }), []);
  assert.throws(() => parsePlaceMatches({ features: [{ ...feature, geometry: { type: 'Point', coordinates: [999, null] } }] }), /no usable/);
  assert.throws(() => parsePlaceMatches({ error: 'busy' }), /unreadable/);
  assert.equal(placeQueryKey(' Philadelphia,   PA '), 'philadelphia, pa');
});

test('Explicit place requests are bounded, identified on native, spaced, and use no GPS bias', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url: new URL(url), options, time: Date.now() }); return Response.json({ features: [feature] }); });
  await fetchPlaceMatches('Test city', new AbortController().signal, true);
  await fetchPlaceMatches('Another city', new AbortController().signal, false);
  assert.equal(calls[0].url.searchParams.get('limit'), '5'); assert.equal(calls[0].url.searchParams.get('q'), 'Test city');
  assert.equal(calls[0].url.searchParams.has('lat'), false); assert.equal(calls[0].url.searchParams.has('lon'), false);
  assert.match(calls[0].options.headers['User-Agent'], /GasFinder/); assert.equal(calls[1].options.headers['User-Agent'], undefined);
  assert.ok(calls[1].time - calls[0].time >= 1000);
  await assert.rejects(fetchPlaceMatches('Town', new AbortController().signal, false, 'http://example.test/api'), /HTTPS/);
});

test('Canceled or failed place requests never fabricate a result, including React Native AbortController', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 503 }); });
  const canceled = new NativeAbortController(); canceled.abort();
  await assert.rejects(fetchPlaceMatches('Town', canceled.signal, true), /canceled/); assert.equal(calls, 0);
  await assert.rejects(fetchPlaceMatches('Town', new NativeAbortController().signal, true), /Place search.*HTTP 503/);
});

test('Recent areas deduplicate and remain bounded; saved GPS is not mislabeled as a recent manual choice', () => {
  let recent = [];
  for (let index = 0; index < 8; index++) recent = rememberArea(recent, { ...area, latitude: 40 + index / 100 });
  assert.equal(recent.length, 5);
  recent = rememberArea(recent, { ...recent[2], label: 'Renamed area' });
  assert.equal(recent[0].label, 'Renamed area'); assert.equal(recent.length, 5);
  assert.deepEqual(rememberArea(recent, { ...area, kind: 'gps' }), recent);
  assert.deepEqual(rememberArea(recent, { ...area, latitude: 99 }), recent);
});

test('Cache coverage is scoped to the exact area and radius; retrieval retains report age and recalculates distance', () => {
  const caches = rememberStations([], cache);
  assert.equal(cachedStations(caches, point, 5).radius, 5);
  assert.equal(cachedStations(caches, point, 25).radius, 5); // Partial coverage, never 25.
  assert.equal(cachedStations(caches, { ...point, latitude: 41 }, 5), null);
  const restored = JSON.parse(JSON.stringify(caches));
  const found = prepareStations(restored[0].stations, { ...point, radius: 5, fuelType: 'regular', sortOrder: 'price' });
  assert.equal(found[0].distanceMiles, 0); assert.equal(found[0].prices[0].reportedAt, station.prices[0].reportedAt);
  assert.equal(isRecentPrice(found[0].prices[0]), false);
  assert.equal(rememberStations(caches, { ...cache, fetchedAt: 'bad date' }), caches);
  let bounded = caches; for (let index = 0; index < 10; index++) bounded = rememberStations(bounded, { ...cache, latitude: 40 + index });
  assert.equal(bounded.length, 6);
});

test('New inner results merge with cached wider coverage without duplicates or retaining removed inner stations', () => {
  const outer = { ...station, id: 'outer', latitude: 40.05 };
  const wider = { ...cache, stations: [station, outer] };
  const fresh = { stations: [{ ...station, name: 'Updated name' }], provider: 'OpenStreetMap', fetchedAt: '2026-10-13T12:00:00Z' };
  const result = stationResults(fresh, undefined, wider, point, 5);
  assert.equal(result.data.stations.length, 2); assert.equal(result.isCached, true); assert.equal(result.fetchedAt, wider.fetchedAt);
  assert.equal(result.data.stations.find(item => item.id === station.id).name, 'Updated name');
  assert.deepEqual(stationResults({ ...fresh, stations: [] }, undefined, wider, point, 5).data.stations.map(item => item.id), ['outer']);
  assert.equal(stationResults(fresh, fresh, wider, point, 5).isCached, false);
  assert.equal(stationResults(fresh, undefined, wider, point, 2).isCached, false);
  assert.equal(stationResults(undefined, undefined, null, point, 5).data, undefined);
});

test('Favorites preserve station identity, can be toggled off, and do not retain copied/deleted prices', () => {
  const favorites = toggleFavorite([], station);
  assert.equal(favorites[0].id, station.id); assert.equal(favorites[0].latitude, station.latitude);
  assert.deepEqual(favorites[0].prices, []); assert.equal(favorites[0].distanceMiles, undefined);
  assert.deepEqual(toggleFavorite(favorites, station), []);
  assert.equal(station.prices.length, 1);
});
