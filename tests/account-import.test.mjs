import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAccountImport, statementBalanceStatus } from '../src/features/bank/accountImport.ts';
import { guessMapping, parseBankCSV, previewBankCSV, previewAccountTransactions } from '../src/features/bank/importLogic.ts';
import { linkAccountTransactions, pocketTransactions } from '../src/features/pocket/transactions.ts';
import { registerBankFile, takeBankFile } from '../src/features/bank/incomingBankFile.ts';
import { suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';

const now = new Date('2026-10-10T12:00:00');
const balance = { amountCents: 245642, asOf: '2026-09-30', page: 1, line: 6 };
const state = (overrides = {}) => ({ activeGoal: null, reservedCents: 25000, reportedBalanceCents: 300000, purchases: [], entries: [], bankImportKeys: [], accountTransactions: [], ...overrides });
function review(text, initial) {
  const csv = parseBankCSV(text), mapping = guessMapping(csv);
  const rows = previewBankCSV(csv, mapping, 'Checking', initial.purchases, initial.bankImportKeys, now).rows;
  const selected = rows.filter((row) => !row.duplicate);
  const movements = linkAccountTransactions(previewAccountTransactions(csv, mapping, 'Checking', now).rows, rows, new Set(selected.map((row) => row.id)));
  return { rows, selected, movements, matches: rows.filter((row) => row.duplicate === 'possible') };
}
const purchase = (id, title = 'Wawa', day = 8) => ({ id, title, amountCents: 447, purchasedAt: new Date(2026, 8, day, 12).toISOString(), source: 'shortcut', decision: 'saved', savedCents: 22 });
const twice = 'Date,Description,Amount\n09/08/2026,POS WAWA 123,-4.47\n09/08/2026,POS WAWA 123,-4.47';

test('Two equal statement purchases match one app log only once, preserve both spending rows and stay deduplicated on reimport', () => {
  const initial = state({ purchases: [purchase('wallet')] });
  const first = review(twice, initial);
  assert.deepEqual(first.rows.map((row) => row.duplicate), ['possible', null]);
  const result = applyAccountImport(initial, first.selected, false, 'Checking', first.movements, { matches: first.matches, balance }, now);
  assert.equal(result.imported, 1); assert.equal(result.matched, 1);
  assert.equal(result.state.purchases.length, 2); assert.equal(result.state.purchases.find((item) => item.id === 'wallet').savedCents, 22);
  assert.equal(result.state.reservedCents, 25000); assert.equal(result.state.reportedBalanceCents, 245642);
  assert.equal(pocketTransactions(result.state.accountTransactions, result.state.purchases).length, 2);
  const repeated = review(twice, result.state);
  assert.deepEqual(repeated.rows.map((row) => row.duplicate), ['known', 'known']);
  assert.equal(repeated.rows[0].matchId, 'wallet');
  const again = applyAccountImport(result.state, repeated.selected, false, 'Checking', repeated.movements, { matches: repeated.matches, balance }, now);
  assert.equal(again.imported, 0); assert.equal(again.transactionsAdded, 0); assert.equal(again.transactionsUpdated, 0); assert.equal(again.balanceUpdated, false);
  assert.equal(pocketTransactions(again.state.accountTransactions, again.state.purchases).length, 2);
});

test('Two app logs explain two equal statement rows, and an explicitly different purchase remains distinct', () => {
  const initial = state({ purchases: [purchase('one'), purchase('two')] });
  const parsed = review(twice, initial);
  assert.deepEqual(new Set(parsed.rows.map((row) => row.matchId)), new Set(['one', 'two']));
  const result = applyAccountImport(initial, [], false, 'Checking', parsed.movements, { matches: parsed.matches }, now);
  assert.equal(result.matched, 2); assert.equal(result.state.purchases.length, 2);
  const selected = parsed.rows;
  const separate = applyAccountImport(initial, selected, false, 'Checking', linkAccountTransactions(parsed.movements, selected, new Set(selected.map((row) => row.id))), {}, now);
  assert.equal(separate.state.purchases.length, 4);
  assert.equal(pocketTransactions(separate.state.accountTransactions, separate.state.purchases).length, 4);
});

test('Merchant matches win over unrelated same-price logs and account scopes cannot steal a match', () => {
  const initial = state({ purchases: [purchase('coffee', 'Coffee'), purchase('wawa', 'Wawa', 6), { ...purchase('other'), bankAccountLabel: 'Savings' }] });
  const parsed = review('Date,Description,Amount\n09/08/2026,POS WAWA 123,-4.47\n09/08/2026,CAFE,-4.47', initial);
  assert.equal(parsed.rows[0].matchId, 'wawa'); assert.equal(parsed.rows[1].matchId, 'coffee');
  assert.equal(review('Date,Description,Amount\n09/08/2026,Shop,-4.47', state({ purchases: [{ ...purchase('other'), bankAccountLabel: 'Savings' }] })).rows[0].duplicate, null);
});

test('Repeated bank reference IDs retain the app purchase link while adding only one bank movement', () => {
  const initial = state({ purchases: [purchase('wallet')] });
  const parsed = review('Date,Description,Amount,Transaction ID\n09/08/2026,Wawa,-4.47,txn-1\n09/08/2026,Wawa,-4.47,txn-1', initial);
  assert.deepEqual(parsed.rows.map((row) => row.duplicate), ['possible', 'known']);
  const result = applyAccountImport(initial, parsed.selected, false, 'Checking', parsed.movements, { matches: parsed.matches }, now);
  assert.equal(result.state.accountTransactions.length, 1); assert.equal(result.state.accountTransactions[0].linkedPurchaseId, 'wallet');
  assert.equal(pocketTransactions(result.state.accountTransactions, result.state.purchases).length, 1);
});

test('A confirmed PDF restores its closing balance after a manual edit without duplicating transactions or balance keys', () => {
  const initial = state();
  const parsed = review('Date,Description,Amount\n09/08/2026,Shop,-10.00\n09/09/2026,Payroll,1000.00', initial);
  const result = applyAccountImport(initial, parsed.selected, false, 'Checking', parsed.movements, { balance }, now);
  assert.equal(result.state.reportedBalanceCents, balance.amountCents); assert.equal(result.state.balanceAsOf, '2026-09-30');
  assert.equal(result.state.reservedCents, 25000); assert.equal(result.transactionsAdded, 2);
  const manual = { ...result.state, reportedBalanceCents: 400000, balanceSource: 'manual', balanceAsOf: '2026-10-10' };
  assert.equal(statementBalanceStatus(manual, balance, 'Checking', now), 'older');
  const restored = applyAccountImport(manual, [], false, 'Checking', [], { balance }, now);
  assert.equal(restored.state.reportedBalanceCents, balance.amountCents);
  assert.equal(restored.balanceUpdated, true); assert.equal(restored.transactionsAdded, 0);
  assert.equal(restored.state.statementBalanceKeys.length, 1);
  assert.equal(statementBalanceStatus(restored.state, balance, 'Checking', now), 'applied');
  assert.equal(applyAccountImport(manual, [], false, 'Checking', [], {}, now).state.reportedBalanceCents, 400000);
  const older = { ...balance, asOf: '2026-08-31' };
  assert.equal(statementBalanceStatus(manual, older, 'Checking', now), 'older');
  assert.equal(statementBalanceStatus(manual, { ...balance, asOf: '2026-12-31' }, 'Checking', now), 'invalid');
  assert.equal(applyAccountImport(manual, [], false, 'Checking', [], { balance: { ...balance, amountCents: -100, asOf: '2026-10-10' } }, now).state.reportedBalanceCents, -100);
});

test('Balance-only import succeeds and savings rules use the new balance', () => {
  assert.equal(applyAccountImport(state(), [], false, 'Checking', [], { balance }, now).balanceUpdated, true);
  const activeGoal = { id: 'trip', title: 'Trip', targetCents: 10000, savedCents: 0, setAsideRule: { mode: 'fixed', cents: 2000 } };
  const initial = state({ activeGoal, reservedCents: 0 });
  const parsed = review('Date,Description,Amount\n09/08/2026,Shop,-10.00', initial);
  const result = applyAccountImport(initial, parsed.selected, true, 'Checking', parsed.movements, { balance: { ...balance, amountCents: 500 } }, now);
  assert.equal(result.savedCents, 500); assert.equal(result.state.reservedCents, 500);
});

test('A matched manual purchase uses bank description/date for subscription evidence without changing its saved contribution', () => {
  const initial = state({ purchases: [{ ...purchase('manual', 'Streaming'), amountCents: 1699 }] });
  const parsed = review('Date,Description,Amount\n09/08/2026,Recurring POS NETFLIX,-16.99', initial);
  const result = applyAccountImport(initial, [], false, 'Checking', parsed.movements, { matches: parsed.matches }, now);
  assert.equal(result.state.purchases.length, 1); assert.equal(result.state.purchases[0].title, 'Streaming');
  assert.equal(result.state.purchases[0].savedCents, 22);
  const suggestion = suggestBankSubscriptions(result.state.purchases, [], [], now)[0];
  assert.equal(suggestion.name, 'Netflix'); assert.equal(suggestion.evidence[0].id, 'manual');
});

test('PDF handoffs accept only local documents, keep paths out of routes and expire/consume once', () => {
  const token = registerBankFile('file:///Documents/Inbox/Private%20Statement.pdf', undefined, 1000);
  assert.ok(token); assert.ok(!token.includes('Private'));
  assert.equal(takeBankFile(token, 1001).name, 'Private Statement.pdf'); assert.equal(takeBankFile(token, 1002), null);
  const android = registerBankFile('content://provider/123', 'application/pdf', 1000);
  assert.equal(takeBankFile(android, 1001).name, 'Citizens statement.pdf');
  const expired = registerBankFile('file:///statement.pdf', undefined, 1000);
  assert.equal(takeBankFile(expired, 302000), null);
  for (const uri of ['https://bank/statement.pdf', 'gasfinder://import?pdf=private', 'file:///script.js', 'file:///%ZZ.pdf']) assert.equal(registerBankFile(uri), null);
});
