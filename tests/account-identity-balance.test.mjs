import assert from 'node:assert/strict';
import test from 'node:test';
import { inferLinkedAccount, resolveLinkedAccount, renameLinkedAccount, sameStatementAccount } from '../src/features/bank/accountIdentity.ts';
import { applyAccountImport, statementBalanceStatus } from '../src/features/bank/accountImport.ts';
import { guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';
import { linkAccountTransactions, pocketTransactions } from '../src/features/pocket/transactions.ts';
import { accountBalanceEstimate, balanceSnapshotIds } from '../src/features/pocket/balanceEstimate.ts';

const now = new Date('2026-10-13T12:00:00');
const iso = (day, time = '12:00:00') => new Date(`${day}T${time}`).toISOString();
const initial = (extra = {}) => ({ activeGoal: null, reservedCents: 0, reportedBalanceCents: 10000, purchases: [], entries: [], bankImportKeys: [], accountTransactions: [], hiddenTransactionIds: [], transactionDirections: {}, balanceIncludedTransactionIds: [], ...extra });
const bank = (id, amountCents, day, extra = {}) => ({ id: `account-${id.repeat(16)}`, title: 'Store', amountCents, occurredAt: iso(day), source: 'citizens-pdf', status: 'posted', accountLabel: 'Checking', ...extra });
const purchase = (id, amountCents, day, extra = {}) => ({ id, title: 'Store', amountCents, purchasedAt: iso(day), source: 'manual', decision: 'pending', ...extra });
const snapshot = { amountCents: 10000, asOf: '2026-09-30', page: 1, line: 1 };
function parsed(text, account, state) {
  const csv = parseBankCSV(text), mapping = guessMapping(csv);
  const rows = previewBankCSV(csv, mapping, account, state.purchases, state.bankImportKeys, now).rows;
  const selected = rows.filter(row => !row.duplicate);
  const history = linkAccountTransactions(previewAccountTransactions(csv, mapping, account, now).rows, rows, new Set(selected.map(row => row.id)));
  return { rows, selected, history, matches: rows.filter(row => row.duplicate === 'possible') };
}

test('Renaming a legacy account preserves import IDs, equal-purchase occurrences, balance keys and hidden rows', () => {
  const text = 'Date,Description,Amount\n09/10/2026,Store,-10.00\n09/10/2026,Store,-10.00';
  const old = initial(), first = parsed(text, 'Checking', old);
  const saved = applyAccountImport(old, first.selected, false, 'Checking', first.history, { balance: snapshot }, now).state;
  saved.hiddenTransactionIds = [saved.accountTransactions[0].id];
  saved.transactionDirections = { [saved.accountTransactions[1].id]: 'in' };
  const account = resolveLinkedAccount(saved, 'Everyday money', 'ending-1234');
  const renamed = { ...saved, ...renameLinkedAccount(saved, account) };
  const repeated = parsed(text, account, renamed);
  assert.deepEqual(repeated.rows.map(row => row.id), first.rows.map(row => row.id));
  assert.deepEqual(repeated.rows.map(row => row.duplicate), ['known', 'known']);
  assert.equal(new Set(repeated.rows.map(row => row.id)).size, 2);
  assert.equal(statementBalanceStatus(renamed, snapshot, account, now), 'applied');
  const result = applyAccountImport(renamed, repeated.selected, false, account, repeated.history, { balance: snapshot }, now);
  assert.equal(result.imported, 0); assert.equal(result.transactionsAdded, 0); assert.equal(result.balanceUpdated, false);
  assert.equal(result.state.purchases.length, 2); assert.equal(result.state.accountTransactions.length, 2);
  assert.ok(result.state.accountTransactions.every(row => row.accountLabel === 'Everyday money' && row.accountId === account.id));
  assert.deepEqual(result.state.hiddenTransactionIds, saved.hiddenTransactionIds);
  assert.deepEqual(result.state.transactionDirections, saved.transactionDirections);
  assert.equal(pocketTransactions(result.state.accountTransactions, result.state.purchases, [], result.state.hiddenTransactionIds).length, 1);
});

test('Account proof permits masked/full variants, strengthens proof, and rejects different full accounts sharing a suffix', () => {
  const linked = resolveLinkedAccount(initial(), 'Checking', '****1234');
  const full = resolveLinkedAccount(initial({ linkedBankAccount: linked }), 'Renamed', '1111111234');
  assert.equal(full.statementIdentifier, '1111111234');
  assert.equal(full.id, linked.id); assert.equal(full.importNamespace, linked.importNamespace);
  assert.equal(resolveLinkedAccount(initial({ linkedBankAccount: full }), 'Renamed', 'ending-1234').statementIdentifier, '1111111234');
  assert.equal(sameStatementAccount('1111111234', '2222221234'), false);
  assert.throws(() => resolveLinkedAccount(initial({ linkedBankAccount: full }), 'Other', '2222221234'), /different bank account/);
  assert.throws(() => applyAccountImport(initial({ linkedBankAccount: full }), [], false, full, [], { statementIdentifier: 'ending-5678' }, now), /different bank account/);
});

test('Legacy linking favors the owner of the current statement balance and preserves unrelated histories', () => {
  const state = initial({ accountTransactions: [bank('1', -100, '2026-09-10'), bank('2', 500, '2026-09-10', { accountLabel: 'Savings' })],
    bankImportAccountLabel: 'Savings', balanceSource: 'citizens-pdf', balanceAsOf: snapshot.asOf,
    statementBalanceKeys: [JSON.stringify(['checking', snapshot.asOf, 10000])] });
  assert.equal(inferLinkedAccount(state).nickname, 'Checking');
  const linked = resolveLinkedAccount(state, 'Everyday');
  assert.equal(renameLinkedAccount(state, linked).accountTransactions[1].accountLabel, 'Savings');
  assert.equal(inferLinkedAccount({ ...state, statementBalanceKeys: [], bankImportAccountLabel: 'Unknown' }), null);
});

test('A PDF balance incorporates its period; only later linked movements and app purchases change the estimate', () => {
  const account = resolveLinkedAccount(initial(), 'Checking');
  const state = initial({ linkedBankAccount: account, balanceSource: 'citizens-pdf', balanceAsOf: snapshot.asOf,
    accountTransactions: [bank('1', -1000, '2026-09-30'), bank('2', -2000, '2026-10-01'), bank('3', 5000, '2026-10-02'),
      bank('4', -900, '2026-10-03', { status: 'pending' }), bank('5', -8000, '2026-10-03', { accountLabel: 'Savings' })],
    purchases: [purchase('new', 700, '2026-10-04'), purchase('old', 600, '2026-09-29')], hiddenTransactionIds: ['new'] });
  const estimate = accountBalanceEstimate(state);
  assert.equal(estimate.estimatedCents, 12300); assert.equal(estimate.deltaCents, 2300);
  assert.equal(estimate.newerCount, 3); assert.equal(estimate.pendingCount, 1);
  assert.equal(state.reportedBalanceCents, 10000);
  assert.equal(accountBalanceEstimate({ ...state, transactionDirections: { [state.accountTransactions[1].id]: 'in' } }).estimatedCents, 16300);
});

test('Matching a Wallet charge to a PDF counts once, then the newer statement absorbs the posted charge', () => {
  const account = resolveLinkedAccount(initial(), 'Checking', 'ending-1234');
  const state = initial({ linkedBankAccount: account, balanceSource: 'citizens-pdf', balanceAsOf: snapshot.asOf,
    purchases: [purchase('wallet', 1000, '2026-10-02', { source: 'shortcut', bankAccountId: account.id, bankAccountLabel: account.nickname })] });
  assert.equal(accountBalanceEstimate(state).estimatedCents, 9000);
  const preview = parsed('Date,Description,Amount\n10/03/2026,Store,-10.00', account, state);
  assert.equal(preview.rows[0].duplicate, 'possible');
  const matched = applyAccountImport(state, [], false, account, preview.history, { matches: preview.matches }, now).state;
  assert.equal(accountBalanceEstimate(matched).estimatedCents, 9000);
  assert.equal(pocketTransactions(matched.accountTransactions, matched.purchases).length, 1);
  const confirmed = applyAccountImport(matched, [], false, account, preview.history, { balance: { ...snapshot, asOf: '2026-10-03', amountCents: 9000 } }, now).state;
  assert.equal(accountBalanceEstimate(confirmed).estimatedCents, 9000);
  assert.equal(accountBalanceEstimate(confirmed).newerCount, 0);
});

test('A manual balance captures known records and ignores synthetic CSV times on its day', () => {
  const known = purchase('known', 1000, '2026-10-12');
  const state = initial({ balanceSource: 'manual', balanceUpdatedAt: iso('2026-10-12', '09:00:00'), balanceAsOf: '2026-10-12',
    balanceIncludedTransactionIds: ['known'], purchases: [known, purchase('later', 700, '2026-10-12', { purchasedAt: iso('2026-10-12', '10:00:00') })],
    accountTransactions: [bank('1', -3000, '2026-10-12', { source: 'csv' }), bank('2', 2000, '2026-10-13', { source: 'csv' })] });
  assert.equal(accountBalanceEstimate(state).estimatedCents, 11300);
  // A newly matched bank row retains the captured local record identity.
  const matched = { ...state, accountTransactions: [...state.accountTransactions, bank('3', -1000, '2026-10-13', { linkedPurchaseId: 'known' })] };
  assert.equal(accountBalanceEstimate(matched).estimatedCents, 11300);
  const pending = bank('4', -1000, '2026-10-12', { status: 'pending' });
  const ids = balanceSnapshotIds({ purchases: [known], accountTransactions: [pending] });
  assert.deepEqual(ids, ['known']);
  const postedLater = initial({ balanceSource: 'manual', balanceUpdatedAt: iso('2026-10-12'), balanceIncludedTransactionIds: ids,
    purchases: [known], accountTransactions: [{ ...pending, status: 'posted', occurredAt: iso('2026-10-13') }] });
  assert.equal(accountBalanceEstimate(postedLater).estimatedCents, 9000);
  assert.equal(accountBalanceEstimate(initial({ reportedBalanceCents: null })).estimatedCents, null);
  assert.equal(accountBalanceEstimate(initial({ purchases: [known] })).estimatedCents, 10000);
});

test('Newer imported spending reduces the savings-rule cap before a reserve is made', () => {
  const account = resolveLinkedAccount(initial(), 'Checking');
  const state = initial({ linkedBankAccount: account, balanceSource: 'citizens-pdf', balanceAsOf: snapshot.asOf,
    activeGoal: { id: 'trip', title: 'Trip', targetCents: 10000, savedCents: 0, setAsideRule: { mode: 'fixed', cents: 2000 } } });
  const preview = parsed('Date,Description,Amount\n10/01/2026,Store,-95.00', account, state);
  const result = applyAccountImport(state, preview.selected, true, account, preview.history, {}, now);
  assert.equal(result.savedCents, 500); assert.equal(result.state.reservedCents, 500);
  assert.equal(accountBalanceEstimate(result.state).estimatedCents, 500);
  assert.equal(result.state.reportedBalanceCents, 10000);
});

test('Legacy parser repair survives the first account binding and carries hidden/direction choices to its new ID', () => {
  const old = bank('1', -1000, '2026-10-01', { title: 'Online Transfer From Checking' });
  const state = initial({ accountTransactions: [old], hiddenTransactionIds: [old.id], transactionDirections: { [old.id]: 'in' },
    balanceSource: 'citizens-pdf', balanceAsOf: snapshot.asOf });
  const account = resolveLinkedAccount(state, 'Checking');
  const corrected = bank('2', 1000, '2026-10-01', { title: old.title, accountId: account.id });
  const result = applyAccountImport(state, [], false, account, [corrected], {}, now);
  assert.equal(result.state.accountTransactions.length, 1);
  assert.equal(result.state.transactionDirections[corrected.id], 'in');
  assert.ok(result.state.hiddenTransactionIds.includes(corrected.id));
  assert.equal(accountBalanceEstimate(result.state).estimatedCents, 11000);
});
