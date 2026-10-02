import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { searchGooglePlaces } from './googlePlaces.mjs';

const host = process.env.STATIONS_HOST || '127.0.0.1';
const port = Number(process.env.STATIONS_PORT || 8787);
const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
const dailyLimit = Number(process.env.STATIONS_DAILY_LIMIT || 100);
let budgetDay = new Date().toISOString().slice(0, 10);
let requestCount = 0;

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function searchInput(url) {
  if (!['latitude', 'longitude', 'radiusMiles', 'fuelType'].every((name) => url.searchParams.has(name))) return null;
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const radiusMiles = Number(url.searchParams.get('radiusMiles'));
  const fuelType = url.searchParams.get('fuelType');
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 25 ||
      !['regular', 'midgrade', 'premium', 'diesel'].includes(fuelType)) return null;
  return { latitude, longitude, radiusMiles };
}

export function createStationsServer({ key = apiKey, search = searchGooglePlaces } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, { status: key ? 'ready' : 'missing-key' });
      return;
    }
    if (request.method !== 'GET' || url.pathname !== '/v1/stations/nearby') {
      send(response, 404, { error: 'Not found.' });
      return;
    }
    const input = searchInput(url);
    if (!input) {
      send(response, 400, { error: 'Enter a valid location, fuel type, and radius up to 25 miles.' });
      return;
    }
    if (!key) {
      send(response, 503, { error: 'The station provider key has not been configured.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today !== budgetDay) { budgetDay = today; requestCount = 0; }
    if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || requestCount >= dailyLimit) {
      send(response, 429, { error: 'The station search limit has been reached for today.' });
      return;
    }
    requestCount += 1;
    try {
      const stations = await search({ apiKey: key, ...input, signal: AbortSignal.timeout(8_000) });
      send(response, 200, { provider: 'Google Maps', stations });
    } catch (error) {
      console.error('Station provider request failed:', error);
      send(response, 502, { error: 'Could not get station data right now. Try again later.' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createStationsServer().listen(port, host, () => {
    console.log(`GasFinder station service listening on http://${host}:${port}`);
  });
}
