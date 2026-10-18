import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePendingWalletPurchase, parsePendingWalletPurchases, walletPurchaseId } from '../src/features/goals/purchaseInbox.ts';
const now = Date.parse('2026-10-18T12:00:00Z');
const draft = { id: '7B42B069-6921-4793-811F-3451856CE000', merchant: 'Corner Shop', amountCents: 1234, currency: 'USD', capturedAt: '2026-10-18T10:00:00Z' };

test('Wallet drafts preserve capture time and use stable UUID purchase identities', () => {
  const row = parsePendingWalletPurchase(draft, now);
  assert.deepEqual(row, { ...draft, id: draft.id.toLowerCase(), capturedAt: '2026-10-18T10:00:00.000Z' });
  assert.ok(parsePendingWalletPurchase({ ...draft, id: '7b42b069-6921-8793-811f-3451856ce000' }, now));
  assert.equal(walletPurchaseId(row), `wallet-${draft.id.toLowerCase()}`);
  assert.equal(walletPurchaseId(parsePendingWalletPurchase(draft, now + 60_000)), walletPurchaseId(row));
});
test('Wallet drafts reject malformed IDs, currencies, amounts, merchants and dates', () => {
  for (const change of [ { id: '../account' }, { id: 'not-a-uuid' }, { currency: 'EUR' }, { amountCents: 0 }, { amountCents: -100 }, { amountCents: 1.1 }, { amountCents: 100000001 }, { amountCents: '1234' }, { merchant: '' }, { merchant: 'x'.repeat(81) }, { merchant: 'Shop\nURL' }, { capturedAt: 'not-a-date' }, { capturedAt: '2026-10-18' }, { capturedAt: '2026-10-18T12:06:00Z' }, { capturedAt: '2026-09-17T12:00:00Z' } ]) assert.equal(parsePendingWalletPurchase({ ...draft, ...change }, now), null, JSON.stringify(change));
  assert.equal(parsePendingWalletPurchase(null, now), null);
});
test('Wallet queue skips invalid payloads, deduplicates IDs, orders captures and bounds size', () => {
  const other = { ...draft, id: '7882b069-6921-4793-811f-3451856ce001', capturedAt: '2026-10-18T11:00:00Z' };
  const rows = parsePendingWalletPurchases([draft, null, {...draft, id:draft.id.toLowerCase()}, other], now);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, other.id);
  assert.deepEqual(parsePendingWalletPurchases(Array.from({length:201},()=>draft),now), []);
  assert.deepEqual(parsePendingWalletPurchases({items:[draft]},now), []);
});
