import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fuelRange, estimatedTankGallons, validateCar } from '../src/features/vehicles/logic.ts';
import { chooseStop, nextStopWindow, planDriveStops, safeRange } from '../src/features/stations/multiStopLogic.ts';
import { appleMapsTrip, googleMapsTripSegments } from '../src/features/stations/maps.ts';
import { driveRouteWindow, parseDestinationInput } from '../src/features/stations/routeLogic.ts';
import { preferredMapsApp, validateRefillPercent } from '../src/features/stations/preferences.ts';

const car = { id: 'car-a', name: 'My Subaru', model: 'Subaru Crosstrek', mpg: 28, tankGallons: 14, estimateSource: 'estimate' };
const station = (id, milesAhead, price, milesOffRoute = 0.1, source = 'report') => ({ id, name: id, latitude: 40, longitude: -75 + milesAhead / 1000, milesAhead, milesOffRoute, prices: price ? [{ fuelType: 'regular', price, source }] : [], address: '', city: '', state: '' });
const inWindow = (all, window) => all.filter((item) => item.milesAhead >= window.searchStartMiles && item.milesAhead <= window.searchEndMiles);

test('percent fuel uses saved capacity and MPG, gallons never exceed the tank', () => {
  assert.deepEqual(fuelRange(car, 50, 'percent'), fuelRange(car, 7, 'gallons'));
  assert.equal(fuelRange(car, 100, 'percent').fullRange, 14 * 28 * .85);
  assert.throws(() => fuelRange(car, 101, 'percent'));
  assert.throws(() => fuelRange(car, 15, 'gallons'));
  assert.throws(() => fuelRange(car, 0, 'percent'));
  assert.throws(() => validateCar({ ...car, mpg: NaN }));
  assert.throws(() => validateCar({ ...car, tankGallons: 0 }));
  assert.equal(estimatedTankGallons('Small Sport Utility Vehicle 4WD'), 14);
});

test('offline catalog includes gasoline model estimates and EPA provenance', () => {
  const data = JSON.parse(readFileSync(new URL('../src/features/vehicles/catalog.json', import.meta.url)));
  assert.match(data.source, /fueleconomy.gov/);
  assert.ok(data.vehicles.find((item) => item.name === 'Subaru Crosstrek')?.mpg > 10);
  assert.ok(data.vehicles.every((item) => item.mpg > 0 && item.fromYear <= item.toYear));
});

test('refill percentage is of the full tank, including a partially full starting tank', () => {
  assert.equal(safeRange(150, 300, 10), 120);
  assert.equal(safeRange(150, 300, 25), 75);
  assert.equal(safeRange(15, 300, 10), 0);
  assert.equal(nextStopWindow(500, 0, 150, 300, 10).targetMiles, 120);
  assert.equal(nextStopWindow(500, 100, 300, 300, 25).targetMiles, 325);
  assert.throws(() => validateRefillPercent(0));
  assert.throws(() => validateRefillPercent(NaN));
  assert.throws(() => validateRefillPercent(51));
});

test('a changed refill level applies to every later leg of a long drive', async () => {
  const available = [station('one', 70, 3), station('two', 290, 3), station('three', 510, 3)];
  const windows = [];
  const result = await planDriveStops({ routeMiles: 700, initialRange: 150, fullRange: 300, refillPercent: 25, fuelType: 'regular', lookup: async (window) => { windows.push({ ...window }); return inWindow(available, window); } });
  assert.equal(result.complete, true);
  assert.equal(result.stops.length, 3);
  assert.equal(windows[0].targetMiles, 75);
  assert.ok(Math.abs(windows[1].targetMiles - 294.9) < .001);
  assert.ok(result.stops.every((stop) => stop.legMiles <= stop.window.rangeMiles - 75));
});

test('starting below the refill level chooses a nearby reachable station immediately', async () => {
  const result = await planDriveStops({ routeMiles: 100, initialRange: 15, fullRange: 300, refillPercent: 10, fuelType: 'regular', lookup: async (window) => inWindow([station('near', 1, 4), station('cheap-later', 9, 2), station('out-of-reach', 20, 1)], window) });
  assert.equal(result.complete, true);
  assert.equal(result.stops[0].station.id, 'near');
  assert.equal(result.stops[0].window.targetMiles, 0);
});

test('Maps preference uses Apple on iPhone by default and Google on Android', () => {
  assert.equal(preferredMapsApp(null, 'ios'), 'apple');
  assert.equal(preferredMapsApp('google', 'ios'), 'google');
  assert.equal(preferredMapsApp('apple', 'android'), 'google');
});

test('long trips plan multiple reachable refills from the actual chosen stops', async () => {
  const available = [station('first-cheap', 80, 3), station('first-late', 90, 4), station('second', 247, 3.1), station('third', 412, 3.2)];
  const queried = [];
  const result = await planDriveStops({ routeMiles: 550, initialRange: 100, fullRange: 190, fuelType: 'regular', lookup: async (window) => { queried.push({ ...window }); return inWindow(available, window); } });
  assert.equal(result.complete, true);
  assert.deepEqual(result.stops.map((stop) => stop.station.id), ['first-cheap', 'second', 'third']);
  assert.ok(queried[1].targetMiles < 251, 'second search follows the mile 80 stop, not idealized mile 90');
  assert.ok(result.stops.every((stop) => stop.station.milesAhead + 2 * stop.station.milesOffRoute <= stop.window.searchEndMiles));
  assert.ok(result.stops.at(-1).station.milesAhead + safeRange(190 - .1) >= 550);
});

test('a later missing stop retains earlier stops and marks the trip incomplete', async () => {
  const result = await planDriveStops({ routeMiles: 500, initialRange: 100, fullRange: 190, fuelType: 'regular', lookup: async (window) => inWindow([station('first', 75, 3)], window) });
  assert.equal(result.complete, false);
  assert.equal(result.stops.length, 1);
  assert.ok(result.gap.searchEndMiles < 500);
  assert.match(result.reason, /not covered/);
});

test('no station near the preferred refill point searches earlier reachable sections', async () => {
  const result = await planDriveStops({ routeMiles: 300, initialRange: 190, fullRange: 300, fuelType: 'regular', lookup: async (window) => inWindow([station('early-only', 70, 3)], window) });
  assert.equal(result.complete, true);
  assert.equal(result.stops[0].station.id, 'early-only');
});

test('enough fuel performs no search unless explicitly requested', async () => {
  let lookups = 0;
  const args = { routeMiles: 40, initialRange: 100, fullRange: 300, fuelType: 'regular', lookup: async () => { lookups++; return [station('optional', 20, 3)]; } };
  const result = await planDriveStops(args);
  assert.equal(lookups, 0);
  assert.equal(result.needsFuel, false);
  assert.equal(result.stops.length, 0);
  const optional = await planDriveStops({ ...args, forceSearch: true });
  assert.equal(optional.stops.length, 1);
  assert.equal(optional.needsFuel, false);
});

test('detours, repeated stations and simulated prices are excluded from fuel ranking', () => {
  const window = nextStopWindow(400, 0, 100);
  assert.equal(chooseStop([station('too-far', 89, 2, 1)], window, 'regular', []), null);
  const picked = chooseStop([station('fake', 85, .1, .1, 'sample'), station('reported', 82, 4)], window, 'regular', []);
  assert.equal(picked.id, 'reported');
  assert.equal(chooseStop([station('reported', 82, 4)], window, 'regular', ['reported']), null);
});

test('map handoff parses shared message URLs, Apple unified URLs and destination paths', () => {
  assert.equal(parseDestinationInput('Go here\nhttps://maps.apple.com/directions?destination=Boston%2C%20MA&waypoint=NYC'), 'Boston, MA');
  assert.equal(parseDestinationInput('https://www.google.com/maps/place/Grand+Central+Terminal/@40.7,-74,12z'), 'Grand Central Terminal');
});

test('route search windows scale simplified geometry to road mileage', () => {
  const route = { miles: 100, minutes: 90, points: [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }] };
  const segment = driveRouteWindow(route, 25, 50);
  assert.ok(Math.abs(segment[0].longitude - .25) < .001);
  assert.ok(Math.abs(segment.at(-1).longitude - .5) < .001);
});

test('Apple keeps all waypoints; Google chunks preserve every stop and the final destination', () => {
  const stops = Array.from({ length: 9 }, (_, index) => ({ latitude: 40 + index, longitude: -75 }));
  const destination = { latitude: 60, longitude: -75 };
  assert.equal(new URL(appleMapsTrip(destination, stops)).searchParams.getAll('waypoint').length, 9);
  const chunks = googleMapsTripSegments(destination, stops);
  assert.equal(chunks.length, 3);
  const included = [];
  for (const chunk of chunks) {
    const url = new URL(chunk.url);
    const waypoints = url.searchParams.get('waypoints')?.split('|') ?? [];
    assert.ok(waypoints.length <= 3);
    included.push(...waypoints, url.searchParams.get('destination'));
  }
  assert.deepEqual(included, [...stops, destination].map((point) => `${point.latitude},${point.longitude}`));
  assert.equal(chunks.at(-1).reachesDestination, true);
});
