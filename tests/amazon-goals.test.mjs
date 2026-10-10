import assert from 'node:assert/strict';
import test from 'node:test';

import { amazonProductDraft, confirmAmazonProduct, parseAmazonLink, validAmazonProductGoal } from '../src/features/goals/amazonLink.ts';
import { createGoalFromInput, editGoalFromInput, validGoalInput } from '../src/features/goals/logic.ts';

const now = new Date('2026-10-09T12:00:00Z');
const url = 'https://www.amazon.com/dp/B0ABC12345';
const draft = amazonProductDraft(parseAmazonLink(url).value);
const product = confirmAmazonProduct(draft, 'Camera', 123456, 'Black · kit', now);
const input = { title: 'Camera', kind: 'item', targetCents: 123456, deadline: null, setAsideRule: { mode: 'percent', percent: 5 }, product };

test('Amazon product paths normalize ASINs and discard tracking, queries and fragments', () => {
  for (const source of [
    'https://amazon.com/dp/b0abc12345?tag=tracking&price=1#reviews',
    'https://www.amazon.com/Camera-Kit/dp/B0ABC12345/ref=sr_1',
    'https://www.amazon.com/gp/product/B0ABC12345/',
    'https://m.amazon.com/gp/aw/d/B0ABC12345?currency=USD',
  ]) assert.deepEqual(parseAmazonLink(source).value, { sourceUrl: url, asin: 'B0ABC12345', kind: 'product' });
});

test('Short links remain unresolved and never invent product data', () => {
  assert.deepEqual(parseAmazonLink('https://a.co/d/a1Bc23?tag=tracking').value, { sourceUrl: 'https://a.co/d/a1Bc23', asin: null, kind: 'short' });
  const short = amazonProductDraft(parseAmazonLink('https://a.co/a1Bc23').value);
  assert.equal(short.asin, null);
  assert.equal(short.title, '');
  assert.equal(short.priceCents, null);
  assert.equal(short.priceReadAt, null);
  assert.equal(confirmAmazonProduct(short, 'Headphones', 9999, '', now).sourceUrl, 'https://a.co/a1Bc23');
});

test('Links reject deceptive hosts, credentials, private destinations and nonproduct paths', () => {
  for (const source of [
    '', 'not a link', 'http://amazon.com/dp/B0ABC12345', 'javascript:alert(1)',
    'https://amazon.com.evil.test/dp/B0ABC12345', 'https://evilamazon.com/dp/B0ABC12345',
    'https://www.amazon.com@evil.test/dp/B0ABC12345', 'https://evil.test@amazon.com/dp/B0ABC12345',
    'https://amazon.com:8080/dp/B0ABC12345', 'https://127.0.0.1/dp/B0ABC12345',
    'https://[::1]/dp/B0ABC12345', 'https://localhost/dp/B0ABC12345',
    'https://amazon.co.uk/dp/B0ABC12345', 'https://amazon.com/s?k=camera',
    'https://amazon.com/dp/SHORT', 'https://a.co/', 'https://a.co/d/', 'https://a.co/redirect/item',
    'https://amazon.com/dp/B0ABC12345\n?tag=foo', 'https://amazon.com\\@evil.test/dp/B0ABC12345',
    'Camera https://amazon.com/dp/B0ABC12345', 'https://amazon.com/dp/' + 'A'.repeat(2048),
  ]) assert.ok(parseAmazonLink(source).error, source);
});

test('Manual confirmation retains exact cents and validates USD, text and price provenance', () => {
  assert.equal(product.priceCents, 123456);
  assert.equal(product.priceReadAt, now.toISOString());
  assert.equal(product.priceSource, 'manual');
  assert.equal(validAmazonProductGoal(product), true);
  assert.equal(draft.priceCents, null);
  for (const change of [
    { currency: 'EUR' }, { priceCents: 0 }, { priceCents: 10.5 }, { priceCents: 100_000_001 },
    { title: '' }, { title: 'A'.repeat(81) }, { variant: 'A'.repeat(121) }, { title: 'Click\nhere' },
    { asin: 'B0WRONG123' }, { sourceUrl: 'https://evil.test/' }, { priceReadAt: 'not a date' },
    { priceSource: 'automatic' },
  ]) assert.equal(validAmazonProductGoal({ ...product, ...change }), false, JSON.stringify(change));
  assert.equal(confirmAmazonProduct(draft, 'Camera', 0, '', now), null);
  assert.equal(confirmAmazonProduct(draft, 'Camera', 100_000_000, '', now).priceCents, 100_000_000);
});

test('A product goal assigns all or none of the pocket and never mutates the draft', () => {
  const none = createGoalFromInput(input, 3000, false, 'goal', now);
  const all = createGoalFromInput(input, 3000, true, 'goal', now);
  assert.equal(none.savedCents, 0);
  assert.equal(all.savedCents, 3000);
  assert.equal(all.targetCents, 123456);
  assert.deepEqual(JSON.parse(JSON.stringify(all)).product, product);
  assert.equal(validGoalInput({ ...input, targetCents: 9999 }), false);
  assert.equal(validGoalInput({ ...input, product: { ...product, currency: 'CAD' } }), false);
  assert.equal(validGoalInput({ ...input, product: { ...product, title: 'Different item' } }), false);
  assert.equal(createGoalFromInput({ ...input, targetCents: 0 }, 3000, true, 'bad', now), null);
});

test('Confirmed target edits keep saved money, identity and existing purchase rules', () => {
  const goal = createGoalFromInput(input, 3000, true, 'goal', now);
  const later = new Date('2026-10-10T12:00:00Z');
  const updatedProduct = confirmAmazonProduct(product, 'Camera', 99999, 'Silver', later);
  const edited = editGoalFromInput(goal, { ...input, targetCents: 99999, product: updatedProduct });
  assert.equal(edited.savedCents, 3000);
  assert.equal(edited.id, goal.id);
  assert.equal(edited.createdAt, goal.createdAt);
  assert.deepEqual(edited.setAsideRule, goal.setAsideRule);
  assert.equal(edited.product.priceReadAt, later.toISOString());
  assert.equal(edited.product.variant, 'Silver');
  assert.equal(goal.targetCents, 123456);
  assert.equal(goal.product.variant, 'Black · kit');
  const renamed = confirmAmazonProduct(product, 'My camera', product.priceCents, product.variant, later);
  assert.equal(renamed.priceReadAt, product.priceReadAt);
  const { product: ignoredProduct, ...ordinaryEdit } = input;
  assert.equal(editGoalFromInput(goal, ordinaryEdit).product.sourceUrl, url);
  assert.equal(editGoalFromInput(goal, { ...ordinaryEdit, title: 'My camera' }).product.title, 'My camera');
});
