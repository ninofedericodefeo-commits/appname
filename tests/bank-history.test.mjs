import assert from 'node:assert/strict';
import test from 'node:test';

import { createSampleBankTransactions, detectRecurringCharges, isRecurringChargeTracked, parseBankCsv } from '../src/features/bankHistory/logic.ts';

test('CSV import handles quoted merchant names, signed amounts, and duplicate rows', () => {
  const csv = [
    'Transaction Date,Description,Amount',
    '2026-01-15,"Stream, Inc.",-12.99',
    '2026-01-15,"Stream, Inc.",-12.99',
    '2026-01-16,Payroll,2500.00',
    'bad-date,Unknown,-5.00',
  ].join('\r\n');

  const result = parseBankCsv(csv);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].description, 'Stream, Inc.');
  assert.equal(result.transactions[0].amountCents, -1299);
  assert.equal(result.transactions[1].amountCents, 250000);
  assert.equal(result.skippedRows, 1);
});

test('separate debit and credit columns become signed history amounts', () => {
  const result = parseBankCsv([
    'Date,Payee,Debit,Credit',
    '01/05/2026,Video Service,15.00,',
    '01/06/2026,Employer,,500.00',
  ].join('\n'));
  assert.deepEqual(result.transactions.map(({ amountCents }) => amountCents), [-1500, 50000]);
});

test('CSV import rejects missing headers, invalid dates, and malformed amounts', () => {
  assert.throws(() => parseBankCsv('Date,Description\n2026-01-01,Store'), /amount columns/);
  assert.throws(() => parseBankCsv('Date,Description,Amount\n2026-02-30,Store,-1.00'), /No valid transactions/);
  assert.throws(() => parseBankCsv('Date,Description,Amount\n2026-01-01,Store,1.001'), /No valid transactions/);
});

test('recurring charge detection groups stable monthly merchants and ignores deposits', () => {
  const imported = parseBankCsv([
    'Date,Description,Amount',
    '2026-01-03,NETFLIX.COM 123456,-15.49',
    '2026-02-03,Netflix.com 223456,-15.49',
    '2026-03-03,Netflix.com 323456,-16.49',
    '2026-02-01,Payroll,-1200.00',
    '2026-03-01,One-time Shop,-27.00',
  ].join('\n'));
  const candidates = detectRecurringCharges(imported.transactions);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].merchant, 'Netflix.com 323456');
  assert.equal(candidates[0].cadence, 'monthly');
  assert.equal(candidates[0].amountCents, 1582);
  assert.equal(candidates[0].occurrences, 3);
  assert.equal(candidates[0].day, 3);
  assert.equal(candidates[0].confidence, 'repeated');
  assert.equal(candidates[0].averageIntervalDays, 30);
  assert.equal(candidates[0].minAmountCents, 1549);
  assert.equal(candidates[0].maxAmountCents, 1649);
});

test('recurring charge detection recognizes yearly charges but not irregular purchases', () => {
  const imported = parseBankCsv([
    'Date,Description,Amount',
    '2024-04-12,Cloud Storage,-99.00',
    '2025-04-12,Cloud Storage,-99.00',
    '2026-01-12,Hardware Store,-99.00',
    '2026-03-12,Hardware Store,-99.00',
  ].join('\n'));
  const candidates = detectRecurringCharges(imported.transactions);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].merchant, 'Cloud Storage');
  assert.equal(candidates[0].cadence, 'yearly');
  assert.equal(candidates[0].month, 4);
  assert.equal(candidates[0].day, 12);
  assert.equal(candidates[0].confidence, 'early');
  assert.equal(candidates[0].averageIntervalDays, 365);
});

test('a detected merchant matches an existing subscription despite bank reference suffixes', () => {
  assert.equal(isRecurringChargeTracked('Netflix.com 323456', ['Netflix']), true);
  assert.equal(isRecurringChargeTracked('Cloud Storage', ['Video Service']), false);
});

test('fictional test transactions demonstrate monthly, yearly, and one-off charges plus deposits', () => {
  const now = new Date(2026, 9, 6, 12);
  const sample = createSampleBankTransactions(now);
  const candidates = detectRecurringCharges(sample);

  assert.equal(sample.length, 12);
  assert.equal(sample.every((transaction) => transaction.id.startsWith('sample-')), true);
  assert.equal(sample.every((transaction) => transaction.date <= '2026-10-06'), true);
  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates.map(({ cadence }) => cadence).sort(), ['monthly', 'monthly', 'yearly']);
  assert.equal(sample.some(({ amountCents }) => amountCents > 0), true);
  assert.equal(sample.some(({ description }) => description === 'Sample Coffee Shop'), true);
});

test('sample transactions never contain a future date even early in a month', () => {
  const now = new Date(2026, 9, 1, 8);
  const sample = createSampleBankTransactions(now);
  const today = '2026-10-01';
  assert.equal(sample.every((transaction) => transaction.date <= today), true);
  assert.equal(new Set(sample.map(({ id }) => id)).size, sample.length);
});
