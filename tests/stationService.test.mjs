import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connect } from 'node:net';
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

function rawRequest(port, target, host = 'localhost') {
  return new Promise((resolve, reject) => {
    let response = '';
    const socket = connect({ host: '127.0.0.1', port }, () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    });
    socket.setEncoding('utf8');
    socket.setTimeout(3_000, () => socket.destroy(new Error('HTTP response timed out.')));
    socket.on('data', (chunk) => { response += chunk; });
    socket.on('error', reject);
    socket.on('end', () => resolve({ status: Number(/^HTTP\/1\.1 (\d+)/.exec(response)?.[1]), response }));
  });
}

test('malformed hosts and request targets cannot stop the station process or invoke the provider', { timeout: 15_000 }, async (t) => {
  const moduleUrl = new URL('../server/index.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { createStationsServer } from ${JSON.stringify(moduleUrl)};
    let calls = 0;
    const server = createStationsServer({
      key: 'test-key',
      search: async () => {
        calls += 1;
        if (calls === 2) throw new Error('Expected provider failure.');
        return [{ id: 'call-' + calls, prices: [] }];
      },
    });
    server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port })));
  `], { env: { ...process.env, STATIONS_DAILY_LIMIT: '3' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  const port = await new Promise((resolve, reject) => {
    let stdout = '';
    const timeout = setTimeout(() => reject(new Error(`Station process did not start: ${stderr}`)), 5_000);
    const failed = (error) => { clearTimeout(timeout); reject(error); };
    child.once('error', failed);
    child.once('exit', (code, signal) => failed(new Error(`Station process exited (${code ?? signal}): ${stderr}`)));
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
      if (!stdout.includes('\n')) return;
      clearTimeout(timeout);
      resolve(JSON.parse(stdout.slice(0, stdout.indexOf('\n'))).port);
    });
  });

  for (const host of ['[', '%']) {
    const result = await rawRequest(port, '/health', host);
    assert.equal(result.status, 200, result.response);
    assert.match(result.response, /"status":"ready"/);
  }
  for (const target of ['http://[', 'http://example.com/health', '//[', '/%', '/health#fragment', '/health\\extra', '*']) {
    const result = await rawRequest(port, target);
    assert.equal(result.status, 400, result.response);
    assert.match(result.response, /"error":"Invalid request target\."/);
    assert.ok(result.response.length < 1_024);
  }

  const base = `http://127.0.0.1:${port}`;
  const searchUrl = `${base}/v1/stations/nearby?latitude=39&longitude=-75&radiusMiles=5&fuelType=regular`;
  const firstSearch = await fetch(searchUrl);
  assert.equal(firstSearch.status, 200);
  assert.deepEqual(await firstSearch.json(), { provider: 'Google Maps', stations: [{ id: 'call-1', prices: [] }] });
  const providerFailure = await fetch(searchUrl);
  assert.equal(providerFailure.status, 502);
  assert.deepEqual(await providerFailure.json(), { error: 'Could not get station data right now. Try again later.' });
  const recoveredSearch = await fetch(searchUrl);
  assert.equal(recoveredSearch.status, 200);
  assert.deepEqual(await recoveredSearch.json(), { provider: 'Google Maps', stations: [{ id: 'call-3', prices: [] }] });
  assert.equal((await fetch(searchUrl)).status, 429);
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal(child.exitCode, null, stderr);
});
