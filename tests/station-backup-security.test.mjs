import assert from 'node:assert/strict';
import test from 'node:test';
import { webUrl } from '../src/lib/webUrl.ts';
import { validateStoreState } from '../src/features/data/validation.ts';
const station = { id: 'synthetic-station', name: 'Synthetic station', address: 'Test address', city: 'Test city', state: 'PA', latitude: 39, longitude: -75, prices: [], attributions: [{ provider: 'Synthetic provider', providerUri: 'https://example.com/attribution' }] };
const state = value => ({ favorites: [value], stationCaches: [{ stations: [value] }] });
test('restored favorites and caches pass the same station validation as network results', () => {
  assert.doesNotThrow(() => validateStoreState('gasfinder-gas-search', state(station), {}));
  for (const uri of ['javascript:alert(1)', 'data:text/html,test', 'file:///private/test', 'gasfinder://import-purchase?amount=1&merchant=Test', 'https://user:password@example.com']) {
    const bad = { ...station, attributions: [{ provider: 'Synthetic provider', providerUri: uri }] };
    assert.throws(() => validateStoreState('gasfinder-gas-search', state(bad), {}));
    assert.throws(() => validateStoreState('gasfinder-gas-search', { favorites: [], stationCaches: [{ stations: [bad] }] }, {}));
  }
  assert.throws(() => validateStoreState('gasfinder-gas-search', state({ ...station, prices: null }), {}));
});
test('website destinations reject alternate executable schemes and malformed/credential URLs', () => {
  for (const value of ['java\tscript:alert(1)', '\u0000https://example.com', '//example.com', 'https://', {}, null]) assert.equal(webUrl(value), null);
  assert.equal(webUrl('https://example.com/a?q=1'), 'https://example.com/a?q=1');
  assert.equal(webUrl('http://example.com/a'), 'http://example.com/a');
});
