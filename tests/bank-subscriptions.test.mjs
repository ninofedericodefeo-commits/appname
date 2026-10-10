import assert from 'node:assert/strict';
import test from 'node:test';
import { bankMerchant, suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';
const now = new Date('2026-10-10T12:00:00');
const charge = (date, title = 'NETFLIX', amountCents = 1699, extra = {}) => ({ id: `${date}-${title}`, title, amountCents, purchasedAt: new Date(`${date}T12:00:00`).toISOString(), source: 'bank-import', decision: 'pending', ...extra });
const monthly = [charge('2026-07-08'), charge('2026-08-08'), charge('2026-09-08')];

test('Monthly bank charges produce evidence and editable latest charge/posted date estimates', () => {
  const result = suggestBankSubscriptions([...monthly, charge('2026-10-08', 'Recurring POS NETFLIX ref 102900', 1799)], [], [], now);
  assert.equal(result.length, 1); assert.equal(result[0].name, 'Netflix'); assert.equal(result[0].cadence, 'monthly');
  assert.equal(result[0].amountCents, 1799); assert.equal(result[0].day, 8); assert.equal(result[0].evidence.length, 4);
  assert.equal(result[0].confidence, 'repeated');
});

test('Annual and month-end posting patterns use calendar dates across leap years and DST', () => {
  const yearly = suggestBankSubscriptions([charge('2025-09-30', 'Adobe', 5999), charge('2026-09-30', 'Adobe', 5999)], [], [], now);
  assert.equal(yearly[0].cadence, 'yearly'); assert.equal(yearly[0].month, 9);
  const monthEnds = suggestBankSubscriptions([charge('2026-01-31'), charge('2026-02-28'), charge('2026-03-31')], [], [], new Date('2026-04-10T12:00:00'));
  assert.equal(monthEnds[0].cadence, 'monthly'); assert.equal(monthEnds[0].day, 31);
});

test('A lone known provider or explicit recurring charge is labeled possible, generic shopping is not', () => {
  const result = suggestBankSubscriptions([charge('2026-09-08'), charge('2026-09-10', 'AMZN Mktp'), charge('2026-09-10', 'APPLE.COM/BILL'), charge('2026-09-15', 'Gym', 3000, { recurringHint: true })], [], [], now);
  assert.deepEqual(result.map((row) => row.name).sort(), ['Gym', 'Netflix']); assert.ok(result.every((row) => row.confidence === 'possible'));
  assert.equal(bankMerchant('POS AMZN PRIME ref 12345').name, 'Amazon Prime');
  assert.equal(bankMerchant('Recurring ACH debit Gym ref 102900').key, 'gym');
});

test('Existing, renamed or canceled subscriptions and dismissed suggestions are not proposed again', () => {
  assert.equal(suggestBankSubscriptions(monthly, [{ name: 'Netflix', active: false }], [], now).length, 0);
  assert.equal(suggestBankSubscriptions(monthly, [{ name: 'My movies', bankMerchantKey: 'netflix', active: true }], [], now).length, 0);
  assert.equal(suggestBankSubscriptions(monthly, [], ['netflix|monthly'], now).length, 0);
  assert.equal(suggestBankSubscriptions(monthly, [], [], now).length, 1);
});

test('Exclude non-bank data, invalid/future/stale entries, transfer/fees and noisy recurring patterns', () => {
  const inputs = [charge('2026-09-08', 'Netflix', 1699, { source: 'manual' }), charge('2026-09-08', 'Recurring ATM Netflix', 1699, { recurringHint: true }), charge('2026-09-08', 'Recurring service fee', 100, { recurringHint: true }), charge('2026-10-11'), charge('2026-09-08', 'Gym', -1), charge('2026-01-08', 'Spotify')];
  assert.deepEqual(suggestBankSubscriptions(inputs, [], [], now), []);
  assert.deepEqual(suggestBankSubscriptions([charge('2026-09-01'), charge('2026-09-08'), charge('2026-09-15')], [], [], now), []);
  assert.deepEqual(suggestBankSubscriptions([charge('2026-08-08'), charge('2026-09-08', 'Netflix', 10000)], [], [], now), []);
  const duplicate = suggestBankSubscriptions([...monthly, ...monthly], [], [], now);
  assert.equal(duplicate[0].evidence.length, 3);
});
