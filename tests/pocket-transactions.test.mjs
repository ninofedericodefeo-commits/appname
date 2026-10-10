import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBankImport, guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';
import { linkAccountTransactions, mergeAccountTransactions, pocketTransactions } from '../src/features/pocket/transactions.ts';
import { availableCents } from '../src/features/pocket/logic.ts';

const now = new Date('2026-10-10T12:00:00');
function read(text, overrides = {}, account = 'Checking') {
  const csv = parseBankCSV(text);
  const mapping = { ...guessMapping(csv), ...overrides };
  return { csv, mapping, ...previewAccountTransactions(csv, mapping, account, now) };
}
const purchase = (overrides = {}) => ({ id: 'manual-1', title: 'Coffee', amountCents: 500, purchasedAt: new Date(2026, 9, 8, 12).toISOString(), source: 'manual', decision: 'pending', ...overrides });

test('Account history retains signed deposits, transfers, fees and pending entries, rejects invalid/non-USD rows', () => {
  const history = read('Date,Description,Debit,Credit,Type,Status,Currency\n10/08/2026,Payroll,,2000,Deposit,Posted,USD\n10/08/2026,Transfer,250,,Transfer,Posted,USD\n10/08/2026,Service fee,3,,Fee,Posted,USD\n10/09/2026,Coffee,5,,Sale,Pending,USD\n10/08/2026,Ambiguous,1,2,Sale,Posted,USD\n10/08/2026,Euro,5,,Sale,Posted,EUR\n10/11/2026,Future,5,,Sale,Posted,USD\n10/08/2026,,5,,Sale,Posted,USD\n10/08/2026,Invalid,bad,,Sale,Posted,USD');
  assert.deepEqual(history.rows.map((item) => item.amountCents), [200000, -25000, -300, -500]);
  assert.deepEqual(history.rows.map((item) => item.status), ['posted', 'posted', 'posted', 'pending']);
  assert.equal(history.excluded.length, 5);
  assert.equal(previewBankCSV(history.csv, history.mapping, 'Checking', [], [], now).rows.length, 0);
});

test('Signed exports respect spending direction and preserve credits and unknown posting status', () => {
  const rows = read('Date,Description,Amount,Type\n10/08/2026,Coffee,5,Sale\n10/08/2026,Payroll,-2000,Deposit\n10/08/2026,Refund,3,Refund', { spendingSign: 'positive' }).rows;
  assert.deepEqual(rows.map((item) => item.amountCents), [-500, 200000, 300]);
  assert.ok(rows.every((item) => item.status === 'recorded'));
  const negative = read('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/08/2026,Payroll,2000');
  assert.deepEqual(negative.rows.map((item) => item.amountCents), [-500, 200000]);
});

test('Repeated same-day movements remain distinct; overlap and account identities deduplicate', () => {
  const text = 'Date,Description,Amount\n10/08/2026,Coffee,-5\n10/08/2026,Coffee,-5';
  const first = read(text).rows;
  assert.notEqual(first[0].id, first[1].id);
  const merged = mergeAccountTransactions([], first, now);
  assert.equal(merged.added, 2);
  const again = mergeAccountTransactions(merged.transactions, read(text).rows, now);
  assert.equal(again.added, 0); assert.equal(again.updated, 0);
  assert.notEqual(read(text, {}, 'Savings').rows[0].id, first[0].id);
  const csv = read(text).csv; csv.source = 'citizens-pdf';
  assert.equal(previewAccountTransactions(csv, guessMapping(csv), 'Checking', now).rows[0].id, first[0].id);
});

test('Bank transaction IDs promote pending to posted once and older imports cannot downgrade status', () => {
  const pending = read('Date,Description,Amount,Status,Transaction ID\n10/08/2026,Coffee,-5,Pending,txn-1').rows;
  const posted = read('Date,Description,Amount,Status,Transaction ID\n10/09/2026,Coffee shop,-6,Posted,txn-1').rows;
  assert.equal(pending[0].id, posted[0].id);
  const unknown = mergeAccountTransactions([], pending.map((item) => ({ ...item, status: 'recorded' })), now).transactions;
  const suppliedStatus = mergeAccountTransactions(unknown, pending, now);
  assert.equal(suppliedStatus.updated, 1); assert.equal(suppliedStatus.transactions[0].status, 'pending');
  assert.equal(mergeAccountTransactions(suppliedStatus.transactions, unknown, now).transactions[0].status, 'pending');
  const initial = mergeAccountTransactions([], pending, now).transactions;
  const result = mergeAccountTransactions(initial, posted, now);
  assert.equal(result.added, 0); assert.equal(result.updated, 1); assert.equal(result.transactions[0].amountCents, -600);
  assert.equal(initial[0].status, 'pending');
  assert.deepEqual(mergeAccountTransactions(result.transactions, pending, now).transactions, result.transactions);
});

test('Account storage validates rows and keeps only transaction metadata', () => {
  const row = read('Date,Description,Amount\n10/08/2026,Coffee,-5').rows[0];
  const valid = mergeAccountTransactions([], [{ ...row, rawStatement: 'discard', linkedPurchaseId: 'manual-1' }], now).transactions;
  assert.equal(valid[0].rawStatement, undefined); assert.equal(valid[0].rowNumber, undefined);
  assert.equal(valid[0].linkedPurchaseId, 'manual-1');
  const bad = [{ ...row, id: 'invalid' }, { ...row, amountCents: 0 }, { ...row, amountCents: 1.5 }, { ...row, status: 'toString' }, { ...row, occurredAt: '2026-10-11T12:00:00' }];
  assert.equal(mergeAccountTransactions([], bad, now).transactions.length, 0);
});

test('Bank and savings records show once, explicit different purchases survive, savings decisions do not become pending bank charges', () => {
  const existing = purchase({ source: 'shortcut' });
  const { csv, mapping, rows } = read('Date,Description,Amount\n10/08/2026,CAFE 123,-5');
  const review = previewBankCSV(csv, mapping, 'Checking', [existing], [], now);
  assert.equal(review.rows[0].matchId, existing.id);
  const matched = linkAccountTransactions(rows, review.rows, new Set());
  assert.equal(pocketTransactions(matched, [existing]).length, 1);
  const separate = linkAccountTransactions(rows, review.rows, new Set([review.rows[0].id]));
  const selectedPurchase = purchase({ ...review.rows[0], source: 'bank-import' });
  assert.equal(pocketTransactions(separate, [existing, selectedPurchase]).length, 2);
  const manual = pocketTransactions([], [existing]);
  assert.equal(manual[0].status, 'logged'); assert.equal(manual[0].amountCents, -500);
  assert.equal(pocketTransactions([], [purchase({ source: 'bank-import', bankSource: 'citizens-pdf' })])[0].status, 'posted');
});

test('Legacy purchase imports link to new bank history without adding charges or changing saved balances', () => {
  const { csv, mapping, rows } = read('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/09/2026,Payroll,2000');
  const review = previewBankCSV(csv, mapping, 'Checking', [], [], now);
  const state = { purchases: [], entries: [], bankImportKeys: [], reportedBalanceCents: 321099, reservedCents: 25000, activeGoal: null };
  const first = applyBankImport(state, review.rows, false, now);
  const repeat = previewBankCSV(csv, mapping, 'Checking', first.state.purchases, first.state.bankImportKeys, now);
  const bank = mergeAccountTransactions([], linkAccountTransactions(rows, repeat.rows, new Set()), now);
  const combined = pocketTransactions(bank.transactions, first.state.purchases);
  assert.equal(combined.length, 2); assert.equal(combined[0].title, 'Payroll');
  assert.equal(first.state.reportedBalanceCents, 321099); assert.equal(first.state.reservedCents, 25000);
  assert.equal(availableCents(first.state.reportedBalanceCents, first.state.reservedCents), 296099);
  assert.equal(availableCents(10000, 25000), -15000);
  assert.equal(availableCents(null, 25000), null);
});
