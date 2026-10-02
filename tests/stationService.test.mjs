import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { searchGooglePlaces } from '../server/googlePlaces.mjs';
import { createStationsServer } from '../server/index.mjs';

const place = {
  id: 'place-1',
  displayName: { text: 'Market Street Fuel' },
  location: { latitude: 39.95, longitude: -75.16 },
  formattedAddress: '12 Market St, Philadelphia, PA 19106, USA',
  addressComponents: [
    { types: ['country'], text: 'United States', shortText: 'US' },
    { types: ['locality'], text: 'Philadelphia', shortText: 'Philadelphia' },
    { types: ['administrative_area_level_1'], text: 'Pennsylvania', shortText: 'PA' },
    { types: ['postal_code'], text: '19106', shortText: '19106' },
  ],
  fuelOptions: {
    fuelPrices: [
      { type: 'REGULAR_UNLEADED', price: { currencyCode: 'USD', units: '3', nanos: 199_000_000 }, updateTime: '2026-10-01T12:00:00Z' },
      { type: 'PREMIUM', price: { currencyCode: 'EUR', units: '4', nanos: 0 }, updateTime: '2026-10-01T12:00:00Z' },
    ],
  },
  attributions: [{ provider: 'Fuel prices by Example', providerUri: 'https://example.com/fuel' }],
};

test('Google nearby request asks for gas stations and converts only valid US prices', async () => {
  let request;
  const stations = await searchGooglePlaces({
    apiKey: 'test-key',
    latitude: 39.9526,
    longitude: -75.1652,
    radiusMiles: 5,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ places: [place, { ...place, id: 'outside-us', addressComponents: [] }] }) };
    },
  });

  assert.equal(request.url, 'https://places.googleapis.com/v1/places:searchNearby');
  assert.equal(request.options.headers['X-Goog-Api-Key'], 'test-key');
  assert.match(request.options.headers['X-Goog-FieldMask'], /places\.fuelOptions/);
  assert.match(request.options.headers['X-Goog-FieldMask'], /places\.attributions/);
  assert.deepEqual(JSON.parse(request.options.body).includedTypes, ['gas_station']);
  assert.equal(stations.length, 1);
  assert.equal(stations[0].id, 'google:place-1');
  assert.equal(stations[0].state, 'PA');
  assert.deepEqual(stations[0].prices, [{
    fuelType: 'regular',
    price: 3.199,
    currency: 'USD',
    reportedAt: '2026-10-01T12:00:00Z',
    source: 'Google Maps',
  }]);
  assert.deepEqual(stations[0].attributions, [{ provider: 'Fuel prices by Example', providerUri: 'https://example.com/fuel' }]);
});

test('station service validates searches and never calls the provider without a key', async () => {
  const server = createStationsServer({ key: '', search: () => { throw new Error('should not run'); } });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const invalid = await fetch(`${base}/v1/stations/nearby?latitude=39&longitude=-75&radiusMiles=50&fuelType=regular`);
  assert.equal(invalid.status, 400);
  const missingKey = await fetch(`${base}/v1/stations/nearby?latitude=39&longitude=-75&radiusMiles=5&fuelType=regular`);
  assert.equal(missingKey.status, 503);
});

test('station service returns the app contract with provider attribution', async () => {
  const server = createStationsServer({ key: 'test-key', search: async () => [{ id: 'one', prices: [] }] });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${base}/v1/stations/nearby?latitude=39&longitude=-75&radiusMiles=5&fuelType=regular`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { provider: 'Google Maps', stations: [{ id: 'one', prices: [] }] });
});
