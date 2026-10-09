import assert from 'node:assert/strict';
import test from 'node:test';
import NativeAbortController from 'abort-controller';
import { fetchDrivingRoute } from '../src/features/stations/drivingDirections.ts';
import { fetchMapJson, MapServiceError, serviceFailure } from '../src/features/stations/publicMapRequest.ts';

const payload = { code: 'Ok', routes: [{ distance: 160934.4, duration: 3600, geometry: { coordinates: [[-75, 40], [-74, 41]] } }] };
const start = { latitude: 40, longitude: -75 };
const end = { latitude: 41, longitude: -74 };

test('routing falls back after HTTP failure, identifies native GET requests, then caches the route', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options, time: Date.now() });
    return calls.length === 1 ? new Response('', { status: 503 }) : Response.json(payload);
  });
  const signal = new AbortController().signal;
  const route = await fetchDrivingRoute(start, end, signal, true);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /routing.openstreetmap.de\/routed-car/);
  assert.match(calls[0].options.headers['User-Agent'], /GasFinder/);
  assert.ok(calls[1].time - calls[0].time >= 1000);
  assert.equal(route.miles, 100);
  assert.equal(await fetchDrivingRoute(start, end, signal, true), route);
  assert.equal(calls.length, 2);
});

test('route errors identify the failing service and keep the HTTP status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(fetchDrivingRoute(start, { ...end, latitude: 42 }, new AbortController().signal, true), /Driving route lookup.*HTTP 429/);
  assert.match(serviceFailure('Gas station lookup', new MapServiceError('HTTP 504', 504)).message, /Gas station lookup.*HTTP 504/);
});

test('canceling an in-flight route stops fallback requests', async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; controller.abort(); throw new Error('Aborted'); });
  await assert.rejects(fetchDrivingRoute(start, { ...end, latitude: 43 }, controller.signal, true), /Aborted/);
  assert.equal(calls, 1);
});

test('routing works with React Native’s AbortController polyfill', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const controller = new NativeAbortController();
  assert.equal(controller.signal.throwIfAborted, undefined);
  assert.equal((await fetchDrivingRoute(start, { ...end, latitude: 45 }, controller.signal, true)).miles, 100);
  controller.abort();
  await assert.rejects(fetchDrivingRoute(start, end, controller.signal, true), /Trip changed/);
});

test('no connected route is explained without retrying another service', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ code: 'NoRoute', routes: [] }); });
  await assert.rejects(fetchDrivingRoute(start, { ...end, latitude: 44 }, new AbortController().signal, false), /No driving route connects/);
  assert.equal(calls, 1);
});

test('station POST requests and browser requests use the appropriate headers', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push(options); return Response.json({ elements: [] }); });
  const signal = new AbortController().signal;
  await fetchMapJson('https://example.test/stations', signal, 1000, true, 'data=query');
  await fetchMapJson('https://example.test/route', signal, 1000, false);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[1].headers['User-Agent'], undefined);
});

test('timeouts and malformed responses are surfaced instead of hanging or showing fake results', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')))));
  await assert.rejects(fetchMapJson('https://example.test/route', new AbortController().signal, 10, true), /timed out/);
  globalThis.fetch = async () => new Response('<html>busy</html>');
  await assert.rejects(fetchMapJson('https://example.test/route', new AbortController().signal, 1000, true), /unreadable response/);
});
