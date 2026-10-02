import assert from 'node:assert/strict';
import test from 'node:test';

import { appleMapsDirections, googleMapsDirections } from '../src/features/stations/maps.ts';

test('directions links target exact station coordinates', () => {
  const station = { latitude: 39.95, longitude: -75.16 };
  assert.equal(appleMapsDirections(station), 'https://maps.apple.com/?daddr=39.95%2C-75.16&dirflg=d');
  assert.equal(googleMapsDirections(station), 'https://www.google.com/maps/dir/?api=1&destination=39.95%2C-75.16&travelmode=driving');
});
