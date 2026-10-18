import assert from 'node:assert/strict';
import test from 'node:test';
import { directAmazonRoute, incomingAmazonUrl, isSharingPath, sharedPayloadRoute } from '../src/features/sharing/incomingShare.ts';

const product = 'https://www.amazon.com/dp/B0ABC12345';
const noFile = () => null;
const query = (route) => new URL(route, 'https://gasfinder.test').searchParams;

test('Android Amazon share text scans past a title and unrelated first URL', () => {
  const route = sharedPayloadRoute([{ shareType: 'text', value: `See https://example.com, then this Camera: ${product}?tag=tracking` }], noFile);
  assert.ok(route.startsWith('/amazon-goal?'));
  assert.equal(query(route).get('product'), product);
});

test('iOS URL attachments are checked even when text attachment comes first', () => {
  const route = sharedPayloadRoute([
    { shareType: 'text', value: 'Check out this item!' },
    { shareType: 'url', value: 'https://a.co/d/AbC123' },
  ], noFile);
  assert.equal(query(route).get('product'), 'https://a.co/d/AbC123');
  assert.equal(incomingAmazonUrl(`Camera (${product}).`), product);
});

test('Amazon Autos shares retain the vehicle listing instead of becoming product URLs', () => {
  const route = sharedPayloadRoute([{ shareType: 'text', value: '2026 Hyundai https://www.amazon.com/vindp/B0HK2T5GPL?ref=share' }], noFile);
  assert.equal(query(route).get('product'), 'https://www.amazon.com/vindp/B0HK2T5GPL');
});

test('cold and repeated warm shares create distinct deliveries of the same canonical product', () => {
  const items = [{ shareType: 'url', value: product }];
  const first = sharedPayloadRoute(items, noFile);
  const next = sharedPayloadRoute(items, noFile);
  assert.equal(query(first).get('product'), query(next).get('product'));
  assert.notEqual(query(first).get('handoff'), query(next).get('handoff'));
  assert.notEqual(query(directAmazonRoute(product)).get('handoff'), query(directAmazonRoute(product)).get('handoff'));
  assert.equal(isSharingPath('gasfinder://expo-sharing'), true);
  assert.equal(isSharingPath('gasfinder://expo-sharing?delivery=2'), true);
  assert.equal(isSharingPath('gasfinder://amazon-goal'), false);
  assert.equal(isSharingPath('http://['), false);
});

test('bank PDF and CSV handoffs retain precedence and mark shared copies', () => {
  const calls = [];
  const route = sharedPayloadRoute([
    { shareType: 'url', value: product },
    { shareType: 'file', value: 'content://provider/statement', mimeType: 'application/pdf' },
  ], (...args) => { calls.push(args); return 'private-file-token'; });
  assert.equal(route, '/bank-import?bankFileToken=private-file-token');
  assert.equal(calls[0][1], 'application/pdf');
  assert.equal(calls[0][3], true);
  assert.equal(sharedPayloadRoute([{ shareType: 'file', value: 'file:///unknown.exe' }], noFile), '/bank-import');
});

test('Maps and address text keep existing routing with a unique handoff', () => {
  for (const value of ['https://maps.apple.com/?daddr=Boston', 'https://maps.app.goo.gl/abc123', 'Boston, MA']) {
    const route = sharedPayloadRoute([{ shareType: 'text', value }], noFile);
    assert.ok(route.startsWith('/on-route?'));
    assert.equal(query(route).get('destination'), value);
    assert.ok(query(route).get('handoff'));
  }
});

test('malformed and oversized payloads fail safely; unsafe hosts never become Amazon goals', () => {
  for (const payload of [null, {}, [], [null, 42, { value: product }], [{ shareType: 'text', value: 'x'.repeat(16_385) }]]) {
    assert.equal(sharedPayloadRoute(payload, noFile), '/on-route');
  }
  for (const url of ['https://amazon.com.evil.test/dp/B0ABC12345', 'https://user@amazon.com/dp/B0ABC12345', 'http://amazon.com/dp/B0ABC12345', 'https://amazon.com:8080/dp/B0ABC12345', 'javascript:alert(1)']) {
    assert.equal(incomingAmazonUrl(url), null);
    assert.equal(directAmazonRoute(url), null);
    assert.ok(!sharedPayloadRoute([{ shareType: 'url', value: url }], noFile).startsWith('/amazon-goal'));
  }
});
