import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_AMAZON_INPUT_LENGTH, parseAmazonInput } from '../src/features/goals/amazonInput.ts';
import { parseAmazonLink } from '../src/features/goals/amazonLink.ts';
import { incomingAmazonUrl } from '../src/features/sharing/incomingShare.ts';

const product = 'https://www.amazon.com/dp/B0ABC12345';
const vehicle = 'https://www.amazon.com/vindp/B0HGBW2WQ3';

test('mobile product name plus URL works for typed paste, clipboard and incoming shares', () => {
  for (const text of [
    `Camera with 4K video\n${product}?ref=share`,
    `Camera with 4K video ${product}`,
    `“Camera”\r\n(${product}).`,
    `See this: <${product}>`,
    `Camera '${product}'`,
    `[Camera](${product})`,
  ]) {
    assert.equal(parseAmazonInput(text).value?.sourceUrl, product);
    assert.equal(incomingAmazonUrl(text), product);
  }
});

test('Autos title and a.co shares retain the correct listing identity', () => {
  assert.equal(parseAmazonInput(`2026 Hyundai Tucson\n${vehicle}/ref=sr_1_1?ref_=cm_sw_r_cp_ud_vindp_AKCW3EMXBT6BA3HR4P3H`).value?.sourceUrl, vehicle);
  assert.equal(parseAmazonInput('Amazon Camera\nhttps://a.co/d/AbC123').value?.sourceUrl, 'https://a.co/d/AbC123');
});

test('extracts before applying the URL length limit and ignores unrelated URLs', () => {
  assert.equal(parseAmazonInput(`${'Long product description '.repeat(120)}\n${product}`).value?.sourceUrl, product);
  assert.equal(parseAmazonInput(`https://example.com/item\nMy camera: ${product}`).value?.sourceUrl, product);
  assert.equal(parseAmazonInput(`${'x'.repeat(MAX_AMAZON_INPUT_LENGTH)} ${product}`).value, undefined);
});

test('normalization preserves the strict parser and rejects unsafe destinations', () => {
  assert.equal(parseAmazonLink(`Camera\n${product}`).value, undefined);
  for (const url of [
    'https://amazon.com.evil.test/dp/B0ABC12345',
    'https://user@amazon.com/dp/B0ABC12345',
    'https://amazon.com:8443/dp/B0ABC12345',
    'http://amazon.com/dp/B0ABC12345',
    'https://amazon.com/your-orders',
    'https://example.com/https://amazon.com/dp/B0ABC12345',
    'javascript:alert(1)',
  ]) assert.equal(parseAmazonInput(`Camera\n${url}`).value, undefined, url);
  assert.equal(parseAmazonInput(`Camera\u0000 ${product}`).value, undefined);
  assert.equal(parseAmazonInput('Just a product name').value, undefined);
});
