import assert from 'node:assert/strict';
import test from 'node:test';

import { parseImportedPurchase } from '../src/features/goals/importPurchase.ts';

test('Shortcut purchase links parse USD amounts and use a stable explicit ID', () => {
  const first = parseImportedPurchase({ amount: '$12.30', merchant: 'Corner Shop', id: 'wallet-123' });
  const repeat = parseImportedPurchase({ amount: '$12.30', merchant: 'Corner Shop', id: 'wallet-123' }, new Date('2026-10-06T12:00:00Z'));
  assert.equal(first?.amountCents, 1230);
  assert.equal(first?.id, repeat?.id);
  assert.equal(parseImportedPurchase({ amount: '0', merchant: 'Shop' }), null);
  assert.equal(parseImportedPurchase({ amount: '12.30', merchant: '' }), null);
  assert.equal(parseImportedPurchase({ amount: 'USD 1,234.56', merchant: 'Shop' })?.amountCents, 123456);
  assert.equal(parseImportedPurchase({ amount: '1,23.45', merchant: 'Shop' }), null);
});

test('Shortcut currency is checked before changing a USD pocket', () => {
  const params = { amount: '25.50', merchant: 'Shop', currency: 'USD' };
  assert.equal(parseImportedPurchase(params)?.amountCents, 2550);
  assert.equal(parseImportedPurchase({ ...params, currency: 'usd' })?.amountCents, 2550);
  assert.equal(parseImportedPurchase({ ...params, currency: 'EUR' }), null);
  assert.equal(parseImportedPurchase({ ...params, currency: '' }), null);
});
