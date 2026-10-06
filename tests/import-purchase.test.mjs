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
});
