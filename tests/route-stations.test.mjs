import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCoordinateDestination, parseDestinationInput, parseDriveRoute, routePrefix, routeProximity, routeQueryPoints, stationsOnRoute } from '../src/features/stations/routeLogic.ts';

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
