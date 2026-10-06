import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCoordinateDestination, parseDestinationInput, parseDriveRoute, planFuelStop, rankFuelStops, routePrefix, routeProximity, routeQueryPoints, routeWindow, stationsOnRoute } from '../src/features/stations/routeLogic.ts';

test('destination input accepts addresses, coordinates and full Maps directions links', () => {
  assert.equal(parseDestinationInput('  New York, NY  '), 'New York, NY');
  assert.equal(parseDestinationInput('https://maps.apple.com/?daddr=40.7128,-74.0060'), '40.7128,-74.0060');
  assert.equal(parseDestinationInput('https://www.google.com/maps/dir/?api=1&destination=Boston%2C+MA'), 'Boston, MA');
  assert.equal(parseDestinationInput('https://maps.apple.com/?coordinate=40.7128,-74.0060'), '40.7128,-74.0060');
  assert.deepEqual(parseCoordinateDestination('40.7128, -74.0060'), { latitude: 40.7128, longitude: -74.006 });
  assert.equal(parseCoordinateDestination('100, -74'), null);
});

test('route selection keeps only stations close to the driving path', () => {
  const path = [{ latitude: 40, longitude: -75 }, { latitude: 40, longitude: -74 }];
  const onRoute = { id: 'on', latitude: 40.005, longitude: -74.5 };
  const far = { id: 'far', latitude: 40.1, longitude: -74.5 };
  assert.ok(routeProximity(onRoute, path).miles < 1);
  assert.ok(routeProximity(far, path).miles > 1);
  assert.deepEqual(stationsOnRoute([far, onRoute], path, 53).map((station) => station.id), ['on']);
});

test('route prefix and query points cover the upcoming segment', () => {
  const path = Array.from({ length: 201 }, (_, index) => ({ latitude: 40, longitude: -75 + index * 0.005 }));
  const prefix = routePrefix(path, 10);
  assert.ok(prefix.length < path.length);
  const query = routeQueryPoints(prefix, 20);
  assert.ok(query.length <= 20);
  assert.deepEqual(query[0], path[0]);
  assert.deepEqual(query.at(-1), prefix.at(-1));
});

test('driving route response validates distance and coordinates', () => {
  const payload = { routes: [{ distance: 160934.4, duration: 7200, geometry: { coordinates: [[-75, 40], [-74, 40]] } }] };
  assert.equal(parseDriveRoute(payload).miles, 100);
  assert.throws(() => parseDriveRoute({ routes: [{ ...payload.routes[0], geometry: { coordinates: [[-75, 400], [-74, 40]] } }] }), /invalid coordinates/);
  assert.throws(() => parseDriveRoute({ routes: [] }), /No driving route/);
});

test('fuel stop planning searches before the estimated empty point', () => {
  const plan = planFuelStop(280, 190);
  assert.equal(plan.needsFuel, true);
  assert.equal(plan.targetMiles, 171);
  assert.ok(plan.searchStartMiles < plan.targetMiles);
  assert.ok(plan.searchEndMiles < plan.rangeMiles);
  const enoughFuel = planFuelStop(80, 190);
  assert.equal(enoughFuel.needsFuel, false);
  assert.equal(enoughFuel.targetMiles, 40);
  assert.equal(enoughFuel.searchEndMiles, 80);
  const lowFuel = planFuelStop(30, 10);
  assert.equal(lowFuel.targetMiles, 5);
  assert.equal(lowFuel.lastSafeMiles, 8);
});

test('route window and recommendations stay near the fuel stop', () => {
  const path = Array.from({ length: 101 }, (_, index) => ({ latitude: 40, longitude: -75 + index * 0.01 }));
  const window = routeWindow(path, 20, 45);
  assert.ok(window.length < path.length);
  assert.ok(window[0].longitude > path[0].longitude);
  const plan = planFuelStop(100, 60);
  const station = (id, milesAhead, price) => ({ id, name: id, address: '', city: '', state: '', latitude: 40, longitude: -75,
    milesAhead, milesOffRoute: 0.1, prices: price ? [{ fuelType: 'regular', price }] : [], attributions: [] });
  const best = rankFuelStops([station('too-early', 2, 2.5), station('near', 52, 3.5), station('later', 72, 2)], plan, 'regular');
  assert.deepEqual(best.map((item) => item.id), ['near']);
});
