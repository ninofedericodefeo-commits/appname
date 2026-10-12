import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTransactions, pocketTransactions, setTransactionDirection } from '../src/features/pocket/transactions.ts';
import { applyAccountImport } from '../src/features/bank/accountImport.ts';
import { guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';

const bank = { id: 'account-0000000000000001', title: 'Imported transfer', amountCents: -5000, occurredAt: '2026-09-01T12:00:00Z', source: 'citizens-pdf', status: 'posted', accountLabel: 'Checking', linkedPurchaseId: 'imported-purchase' };
const purchase = { id: 'imported-purchase', title: bank.title, amountCents: 5000, purchasedAt: bank.occurredAt, source: 'bank-import', bankSource: 'citizens-pdf', decision: 'skipped' };

test('Explicit ACH credit/direct deposit and debit type fields determine signed CSV direction, without guessing from merchant names', () => {
  const csv = parseBankCSV('Date,Description,Amount,Type\n09/01/2026,Payroll,100.00,ACH CREDIT\n09/02/2026,Payroll,120.00,DIRECT_DEPOSIT\n09/03/2026,Shop,10.00,ACH DEBIT\n09/04/2026,Credit Depot,12.00,DEBIT\n09/05/2026,Credit card payment,50.00,credit card payment');
  for (const spendingSign of ['positive', 'negative']) {
    const mapping = { ...guessMapping(csv), spendingSign };
    const history = previewAccountTransactions(csv, mapping, 'Checking', new Date('2026-10-11T12:00:00Z')).rows;
    assert.deepEqual(history.slice(0, 4).map(row => row.amountCents), [10000, 12000, -1000, -1200]);
    const purchases = previewBankCSV(csv, mapping, 'Checking', [], [], new Date('2026-10-11T12:00:00Z')).rows;
    assert.deepEqual(purchases.map(row => row.title), ['Shop', 'Credit Depot']);
  }
});

test('A generic purchase category never overrides the configured signed amount direction', () => {
  const csv = parseBankCSV('Date,Description,Amount,Type\n09/01/2026,Store reversal,10.00,purchase\n09/02/2026,Store purchase,-12.00,purchase');
  const mapping = { ...guessMapping(csv), spendingSign: 'negative' };
  const now = new Date('2026-10-11T12:00:00Z');
  assert.deepEqual(previewAccountTransactions(csv, mapping, 'Checking', now).rows.map(row => row.amountCents), [1000, -1200]);
  assert.deepEqual(previewBankCSV(csv, mapping, 'Checking', [], [], now).rows.map(row => row.title), ['Store purchase']);
});

test('Correcting bank direction updates sign and filters, preserves source records and restores the imported direction', () => {
  const rows = pocketTransactions([bank], [purchase]);
  const directions = setTransactionDirection(rows, {}, bank.id, 'in');
  assert.deepEqual(directions, { [bank.id]: 'in', [purchase.id]: 'in' });
  const corrected = pocketTransactions([bank], [purchase], [], [], directions);
  assert.equal(corrected.length, 1); assert.equal(corrected[0].amountCents, 5000); assert.equal(corrected[0].directionCorrected, true);
  assert.equal(filterTransactions(corrected, '', 'in').length, 1); assert.equal(filterTransactions(corrected, '', 'out').length, 0);
  assert.equal(bank.amountCents, -5000); assert.equal(purchase.amountCents, 5000);
  const reset = setTransactionDirection(corrected, directions, bank.id, null);
  assert.deepEqual(reset, {}); assert.equal(pocketTransactions([bank], [purchase], [], [], reset)[0].amountCents, -5000);
  assert.equal(pocketTransactions([], [purchase], [], [], directions)[0].amountCents, 5000);
});

test('Corrections do not affect another equal transaction, manually logged purchases, savings or hidden rows', () => {
  const second = { ...bank, id: 'account-0000000000000002', linkedPurchaseId: undefined };
  const manual = { ...purchase, id: 'manual', source: 'manual', bankSource: undefined };
  const adjustment = { id: 'reserve', amountCents: 5000, createdAt: bank.occurredAt, kind: 'reserve' };
  const rows = pocketTransactions([bank, second], [purchase, manual], [adjustment]);
  const directions = setTransactionDirection(rows, {}, bank.id, 'in');
  assert.equal(pocketTransactions([bank, second], [], [], [], directions).find(row => row.id === second.id).amountCents, -5000);
  assert.equal(setTransactionDirection(rows, directions, manual.id, 'in'), directions);
  assert.equal(setTransactionDirection(rows, directions, 'savings-reserve', 'out'), directions);
  assert.equal(pocketTransactions([bank], [purchase], [], [bank.id], directions).length, 0);
});

test('Reimport and parser identity repairs retain history corrections without changing balance or savings', () => {
  const incoming = { ...bank, id: 'account-0000000000000003', title: 'Imported transfer repaired' };
  const state = { activeGoal: null, reservedCents: 1000, reportedBalanceCents: 90000, purchases: [purchase], entries: [], bankImportKeys: [], accountTransactions: [bank],
    transactionDirections: { [bank.id]: 'in' } };
  const result = applyAccountImport(state, [], false, 'Checking', [incoming], {}, new Date('2026-10-11T12:00:00Z'));
  assert.equal(result.state.transactionDirections[incoming.id], 'in');
  assert.equal(result.state.transactionDirections[bank.id], undefined);
  assert.equal(result.state.accountTransactions.length, 1);
  assert.equal(result.state.reportedBalanceCents, state.reportedBalanceCents); assert.equal(result.state.reservedCents, state.reservedCents);
  assert.equal(pocketTransactions(result.state.accountTransactions, result.state.purchases, [], [], result.state.transactionDirections)[0].amountCents, 5000);
});
