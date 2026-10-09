import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBankImport, guessMapping, parseBankAmount, parseBankCSV, parseBankDate, previewBankCSV } from '../src/features/bank/importLogic.ts';

const now = new Date('2026-10-09T20:00:00Z');
const preview = (text, history = [], keys = [], mappingOverrides = {}, account = 'Main checking') => {
  const csv = parseBankCSV(text);
  return previewBankCSV(csv, { ...guessMapping(csv), ...mappingOverrides }, account, history, keys, now);
};
const emptyState = (overrides = {}) => ({ activeGoal: null, reservedCents: 0, reportedBalanceCents: null, purchases: [], entries: [], bankImportKeys: [], ...overrides });
const goal = { id: 'goal-1', title: 'Trip', kind: 'money', targetCents: 5000, savedCents: 0, deadline: null, createdAt: now.toISOString(), setAsideRule: { mode: 'percent', percent: 5 } };

test('CSV handles BOM, CRLF, quoted commas, escaped quotes, multiline descriptions and bank preambles', () => {
  const csv = parseBankCSV('\uFEFFAccount activity\r\nDate,Description,Amount\r\n10/08/2026,"Cafe, ""Downtown""\nCoffee",-4.50\r\n');
  assert.equal(csv.headerRow, 1);
  assert.equal(csv.rows[0][1], 'Cafe, "Downtown"\nCoffee');
  const parsed = previewBankCSV(csv, guessMapping(csv), 'Checking', [], [], now);
  assert.equal(parsed.rows[0].title, 'Cafe, "Downtown" Coffee');
  assert.equal(parsed.rows[0].rowNumber, 3);
  assert.equal(parsed.rows[0].amountCents, 450);
  assert.equal(parseBankCSV('Date;Description;Amount\n2026-10-08;Shop;-9.00').rows[0][1], 'Shop');
  assert.equal(parseBankCSV('Date\tDescription\tAmount\n2026-10-08\tShop\t-9.00').rows[0][2], '-9.00');
  assert.throws(() => parseBankCSV('Date,Description,Amount\n2026-10-08,"Unfinished,-9.00'), /quote/);
  assert.throws(() => parseBankCSV('Date,Description,Amount\n2026-10-08,"Shop"invalid,-9.00'), /closing quote/);
  assert.throws(() => parseBankCSV('x'.repeat(2_000_001)), /2 MB/);
  assert.throws(() => parseBankCSV('Date,Description,Amount\n' + '2026-10-08,Shop,-1\n'.repeat(5001)), /5,000/);
});

test('Amounts and dates reject ambiguous grouping, invalid dates and future dates', () => {
  assert.equal(parseBankAmount('-$1,234.56'), -123456);
  assert.equal(parseBankAmount('(12.30)'), -1230);
  assert.equal(parseBankAmount('USD 25.00'), 2500);
  for (const value of ['1,23.45', 'NaN', '1e3', '£12', '12.345', '(-1.00)']) assert.equal(parseBankAmount(value), null);
  assert.equal(new Date(parseBankDate('02/29/2024', 'mdy', now)).getDate(), 29);
  assert.equal(new Date(parseBankDate('03/04/2026', 'dmy', now)).getMonth(), 3);
  assert.equal(new Date(parseBankDate('03/04/2026', 'mdy', now)).getMonth(), 2);
  assert.equal(parseBankDate('02/29/2025', 'mdy', now), null);
  assert.equal(parseBankDate('2026-10-10', 'mdy', now), null);
  assert.equal(parseBankDate('4/1/26', 'mdy', now), null);
});

test('Preview respects spending direction and excludes credits, transfers, pending entries and other currencies', () => {
  const parsed = preview('Date,Description,Amount,Type,Status,Currency\n2026-10-08,Shop,-10,Sale,Posted,USD\n2026-10-08,Deposit,100,Deposit,Posted,USD\n2026-10-08,Transfer,-20,Transfer,Posted,USD\n2026-10-08,Pending,-30,Sale,Pending,USD\n2026-10-08,Euro,-40,Sale,Posted,EUR\n2026-10-08,Refund,10,Refund,Posted,USD\n2026-10-08,Invalid,bad,Sale,Posted,USD');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.excluded.length, 6);
  assert.equal(parsed.rows[0].amountCents, 1000);
  const positive = preview('Date,Description,Amount\n2026-10-08,Shop,10\n2026-10-08,Refund,-10', [], [], { spendingSign: 'positive' });
  assert.equal(positive.rows.length, 1);
  assert.equal(positive.rows[0].title, 'Shop');
  const split = preview('Date,Description,Debit,Credit\n2026-10-08,Shop,10,\n2026-10-08,Deposit,,100\n2026-10-08,Unclear,10,3');
  assert.equal(split.rows.length, 1);
  assert.equal(split.excluded.length, 2);
  assert.throws(() => preview('Date,Description,Amount\n2026-10-08,Shop,-10', [], [], { amount: 0 }), /separate/);
});

test('Repeat and overlapping exports keep stable IDs, repeated legitimate rows remain distinct, and account nicknames scope identities', () => {
  const first = preview('Date,Description,Amount\n2026-10-07,Coffee,-5\n2026-10-08,Shop,-10\n2026-10-08,Shop,-10');
  assert.notEqual(first.rows[1].id, first.rows[2].id);
  const imported = applyBankImport(emptyState(), first.rows, false, now);
  const overlap = preview('Date,Description,Amount\n2026-10-08,Shop,-10\n2026-10-08,Shop,-10\n2026-10-09,Store,-20', imported.state.purchases, imported.state.bankImportKeys);
  assert.deepEqual(overlap.rows.map((row) => row.duplicate), ['known', 'known', null]);
  const otherAccount = preview('Date,Description,Amount\n2026-10-08,Shop,-10', [], [], {}, 'Other card');
  assert.notEqual(otherAccount.rows[0].id, first.rows[1].id);
  const withIds = preview('Date,Description,Amount,Transaction ID\n2026-10-08,Shop,-10,txn-1\n2026-10-08,Shop,-10,txn-1');
  assert.equal(withIds.rows[1].duplicate, 'known');
});

test('Same-day amount matches to Apple Pay and manual logs require review instead of silently counting twice', () => {
  const existing = [{ id: 'apple-pay', title: 'Coffee', amountCents: 500, purchasedAt: new Date(2026, 9, 8, 12).toISOString(), source: 'shortcut', decision: 'saved' }];
  const rows = preview('Date,Description,Amount\n2026-10-08,CAFE 123,-5\n2026-10-08,Shop,-10', existing).rows;
  assert.equal(rows[0].duplicate, 'possible');
  assert.equal(rows[0].matchTitle, 'Coffee');
  assert.equal(rows[1].duplicate, null);
});

test('History-only import retains transaction dates, adds no pocket money and cannot repeat after deletion', () => {
  const rows = preview('Date,Description,Amount\n2026-10-08,Shop,-10').rows;
  const initial = emptyState({ activeGoal: goal });
  const result = applyBankImport(initial, rows, false, now);
  assert.equal(result.imported, 1);
  assert.equal(result.savedCents, 0);
  assert.equal(result.state.purchases[0].source, 'bank-import');
  assert.equal(result.state.purchases[0].purchasedAt, rows[0].purchasedAt);
  assert.equal(result.state.purchases[0].decision, 'skipped');
  assert.equal(result.state.reservedCents, 0);
  assert.equal(initial.purchases.length, 0);
  const repeat = applyBankImport({ ...result.state, purchases: [] }, rows, true, now);
  assert.equal(repeat.imported, 0);
  assert.equal(repeat.savedCents, 0);
});

test('Confirmed bank imports apply rules oldest first and cap every set-aside at the goal and available balance', () => {
  const rows = preview('Date,Description,Amount\n2026-10-08,Later,-20\n2026-10-07,Earlier,-10\n2026-10-09,Last,-30').rows;
  const result = applyBankImport(emptyState({ activeGoal: { ...goal, savedCents: 200, setAsideRule: { mode: 'fixed', cents: 700 } }, reservedCents: 400, reportedBalanceCents: 1200 }), rows, true, now);
  assert.equal(result.savedCents, 800);
  assert.equal(result.state.reservedCents, 1200);
  assert.equal(result.state.activeGoal.savedCents, 1000);
  assert.equal(result.state.purchases.find((purchase) => purchase.title === 'Earlier').savedCents, 700);
  assert.equal(result.state.purchases.find((purchase) => purchase.title === 'Later').savedCents, 100);
  assert.equal(result.state.entries.length, 2);
  const capped = applyBankImport(emptyState({ activeGoal: { ...goal, savedCents: 4990 } }), rows, true, now);
  assert.equal(capped.savedCents, 10);
  assert.equal(capped.state.activeGoal.savedCents, 5000);
  assert.equal(applyBankImport(result.state, rows, true, now).imported, 0);
});
