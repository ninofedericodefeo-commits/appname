import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { applyAccountImport } from '../src/features/bank/accountImport.ts';
import { saveImportToArchive } from '../src/features/bank/archiveLogic.ts';
import { extractPDFText } from '../src/features/bank/extractPDFText.ts';
import { parseCitizensStatement } from '../src/features/bank/citizensStatement.ts';
import { importSharedStatement, prepareAutomaticStatement } from '../src/features/bank/statementAutomation.ts';
import { pocketTransactions } from '../src/features/pocket/transactions.ts';
import { suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';

const now = new Date('2026-10-10T12:00:00');
const settings = { enabled: true, accountLabel: 'Main checking', confirmedAccountIdentifier: '00000000' };
const initial = () => ({ activeGoal: { id: 'trip', title: 'Trip', targetCents: 10000, savedCents: 0, setAsideRule: { mode: 'fixed', cents: 2000 } },
  reservedCents: 25000, reportedBalanceCents: 300000, purchases: [], entries: [], bankImportKeys: [], accountTransactions: [] });
const bytes = await readFile(new URL('./fixtures/citizens-synthetic.pdf', import.meta.url));
const file = { name: 'Synthetic checking.pdf', kind: 'pdf', base64: bytes.toString('base64') };
const statement = parseCitizensStatement(await extractPDFText(file.base64), now);
const prepare = (state = initial(), setup = settings, pdf = statement, shared = true) => prepareAutomaticStatement(setup, shared, pdf, state, now);
function memoryArchive() {
  const entries = new Map(), files = new Map();
  return { entries, files, storage: { list: async () => [...entries.values()], read: async (entry) => files.get(entry.id),
    write: async (entry, data) => { entries.set(entry.id, entry); files.set(entry.id, data); } } };
}

test('A shared PDF saves its original before updating balance, full spending history and subscription evidence; repeats add nothing', async () => {
  assert.equal(statement.accountIdentifier, settings.confirmedAccountIdentifier);
  let state = initial();
  const archive = memoryArchive();
  const run = () => importSharedStatement({
    balanceChoice: 'statement',
    prepare: () => prepare(state), isCurrent: () => true,
    archive: (plan) => saveImportToArchive(archive.storage, file, { accountLabel: plan.accountLabel, transactionCount: plan.transactionCount, purchaseCount: plan.purchaseCount }, now),
    commit: (plan, balance) => {
      assert.equal(archive.files.size, 1);
      const result = applyAccountImport(state, plan.purchases, false, plan.accountLabel, plan.history, { balance }, now);
      state = result.state; return result;
    },
  });
  const first = await run();
  assert.equal(first.status, 'saved'); assert.equal(first.result.imported, 9); assert.equal(first.result.transactionsAdded, 21);
  assert.equal(state.reportedBalanceCents, statement.balance.amountCents); assert.equal(state.balanceAsOf, '2026-09-30');
  assert.equal(state.reservedCents, 25000); assert.equal(first.result.savedCents, 0); assert.equal(state.activeGoal.savedCents, 0);
  assert.equal(pocketTransactions(state.accountTransactions, state.purchases).length, 21);
  assert.equal(suggestBankSubscriptions(state.purchases, [], [], now).find((item) => item.name === 'Netflix').evidence.length, 3);
  const repeated = await run();
  assert.equal(repeated.status, 'saved'); assert.equal(repeated.result.imported, 0); assert.equal(repeated.result.transactionsAdded, 0);
  assert.equal(repeated.result.balanceUpdated, false); assert.equal(archive.files.size, 1); assert.equal(state.purchases.length, 9);
});

test('A PDF requires a balance answer; keeping the balance still saves history and later choosing the PDF amount adds no duplicates', async () => {
  let state = { ...initial(), balanceAsOf: '2026-09-01', balanceSource: 'manual', balanceUpdatedAt: '2026-09-01T12:00:00Z' };
  const before = state;
  const archive = memoryArchive();
  let commits = 0;
  const run = (balanceChoice) => importSharedStatement({
    balanceChoice, prepare: () => prepare(state), isCurrent: () => true,
    archive: (plan) => saveImportToArchive(archive.storage, file, { accountLabel: plan.accountLabel, transactionCount: plan.transactionCount, purchaseCount: plan.purchaseCount }, now),
    commit: (plan, balance) => {
      commits++;
      const result = applyAccountImport(state, plan.purchases, false, plan.accountLabel, plan.history, { balance }, now);
      state = result.state; return result;
    },
  });
  for (const choice of [undefined, 'unanswered']) {
    const waiting = await run(choice);
    assert.equal(waiting.status, 'review'); assert.match(waiting.reason, /Choose/);
    assert.equal(archive.files.size, 0); assert.equal(commits, 0); assert.equal(state, before);
  }
  const kept = await run('current');
  assert.equal(kept.status, 'saved'); assert.equal(kept.result.balanceUpdated, false);
  assert.equal(kept.result.imported, 9); assert.equal(kept.result.transactionsAdded, 21); assert.equal(archive.files.size, 1);
  assert.equal(state.reportedBalanceCents, before.reportedBalanceCents); assert.equal(state.balanceAsOf, before.balanceAsOf);
  assert.equal(state.balanceSource, before.balanceSource); assert.equal(state.balanceUpdatedAt, before.balanceUpdatedAt);
  assert.equal(state.reservedCents, before.reservedCents);
  assert.equal(suggestBankSubscriptions(state.purchases, [], [], now).find((item) => item.name === 'Netflix').evidence.length, 3);
  const updated = await run('statement');
  assert.equal(updated.status, 'saved'); assert.equal(updated.result.balanceUpdated, true);
  assert.equal(updated.result.imported, 0); assert.equal(updated.result.transactionsAdded, 0); assert.equal(archive.files.size, 1);
  assert.equal(state.reportedBalanceCents, statement.balance.amountCents); assert.equal(state.balanceAsOf, statement.balance.asOf);
  assert.equal(state.reservedCents, before.reservedCents);
});

test('Automatic import needs explicit opt-in, shared input and one confirmed matching bank account', () => {
  for (const [setup, pdf, shared, reason] of [
    [{ ...settings, enabled: false }, statement, true, /Review and save/],
    [settings, statement, false, /Review and save/],
    [{ ...settings, accountLabel: ' ' }, statement, true, /nickname/],
    [{ ...settings, confirmedAccountIdentifier: null }, statement, true, /first statement/],
    [settings, { ...statement, accountIdentifier: null }, true, /account number/],
    [settings, { ...statement, accountIdentifier: '11111111' }, true, /different account/],
  ]) {
    const result = prepare(initial(), setup, pdf, shared);
    assert.equal(result.status, 'review'); assert.match(result.reason, reason);
  }
});

test('Warnings, missing/invalid/older balances and unreadable ledger rows require review', () => {
  const cases = [
    [initial(), { ...statement, warnings: [{ page: 2, line: 9, reason: 'Unreadable spending' }] }, /warnings/],
    [initial(), { ...statement, balance: null }, /closing balance/],
    [initial(), { ...statement, balance: { ...statement.balance, asOf: '2027-01-01' } }, /date/],
    [{ ...initial(), balanceAsOf: '2026-10-10', balanceSource: 'manual' }, statement, /before your saved balance/],
    [initial(), { ...statement, csv: { ...statement.csv, rows: [...statement.csv.rows, ['09/09/2026', 'Bad amount', 'wat', '', 'purchase', 'USD']] } }, /transactions/],
    [initial(), { ...statement, csv: { ...statement.csv, rows: [['09/09/2026', 'Foreign charge', '10.00', '', 'purchase', 'EUR']] } }, /transactions/],
  ];
  for (const [state, pdf, reason] of cases) { const result = prepare(state, settings, pdf); assert.equal(result.status, 'review'); assert.match(result.reason, reason); }
  // Expected credits/transfers excluded from purchase totals still enter bank history.
  assert.equal(prepare().status, 'ready');
});

test('Two equal PDF purchases remain distinct, while an app purchase match pauses automatic saving', () => {
  const pdf = { ...statement, csv: { ...statement.csv, rows: [['09/08/2026', 'Wawa', '4.47', '', 'purchase', 'USD'], ['09/08/2026', 'Wawa', '4.47', '', 'purchase', 'USD']], locations: [] } };
  const plan = prepare(initial(), settings, pdf); assert.equal(plan.status, 'ready');
  assert.equal(plan.purchases.length, 2); assert.notEqual(plan.purchases[0].id, plan.purchases[1].id);
  const state = { ...initial(), purchases: [{ id: 'wallet', title: 'Wawa', amountCents: 447, purchasedAt: new Date(2026, 8, 8, 12).toISOString(), source: 'shortcut', decision: 'saved', savedCents: 22 }] };
  assert.match(prepare(state, settings, pdf).reason, /already logged/);
});

test('Storage failure, canceled handoffs and live changes never commit an automatic import', async () => {
  let commits = 0;
  await assert.rejects(importSharedStatement({ balanceChoice: 'statement', prepare: () => prepare(), isCurrent: () => true,
    archive: async () => { throw new Error('Storage full'); }, commit: () => commits++ }), /Storage full/);
  assert.equal(commits, 0);
  let current = true;
  const canceled = await importSharedStatement({ balanceChoice: 'statement', prepare: () => prepare(), isCurrent: () => current,
    archive: async () => { current = false; }, commit: () => commits++ });
  assert.equal(canceled.status, 'canceled'); assert.equal(commits, 0);
  let state = initial();
  const changed = await importSharedStatement({ balanceChoice: 'statement', prepare: () => prepare(state), isCurrent: () => true,
    archive: async () => { state = { ...state, balanceAsOf: '2026-10-10' }; }, commit: () => commits++ });
  assert.equal(changed.status, 'review'); assert.match(changed.reason, /saved balance/); assert.equal(commits, 0);
  let setup = settings;
  const disabled = await importSharedStatement({ balanceChoice: 'statement', prepare: () => prepare(state = initial(), setup), isCurrent: () => true,
    archive: async () => { setup = { ...settings, enabled: false }; }, commit: () => commits++ });
  assert.equal(disabled.status, 'review'); assert.equal(commits, 0);
  let walletState = initial();
  const walletArrived = await importSharedStatement({ balanceChoice: 'statement', prepare: () => prepare(walletState), isCurrent: () => true,
    archive: async () => { walletState = { ...walletState, purchases: [{ id: 'late-wallet', title: 'Netflix', amountCents: 1699,
      purchasedAt: new Date(2026, 8, 5, 12).toISOString(), source: 'shortcut', decision: 'saved', savedCents: 22 }] }; }, commit: () => commits++ });
  assert.equal(walletArrived.status, 'review'); assert.match(walletArrived.reason, /already logged/); assert.equal(commits, 0);
});

test('The bundled shortcut accepts a local PDF and opens the registered GasFinder app without network or URL payloads', async () => {
  const workflow = JSON.parse(await readFile(new URL('../assets/shortcuts/import-statement.workflow.json', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.WFWorkflowInputContentItemClasses, ['WFPDFContentItem']);
  assert.deepEqual(workflow.WFWorkflowTypes, ['ActionExtension']);
  assert.equal(workflow.WFWorkflowNoInputBehavior.Name, 'WFWorkflowNoInputBehaviorShowError');
  assert.equal(workflow.WFWorkflowActions.length, 1);
  const action = workflow.WFWorkflowActions[0];
  assert.equal(action.WFWorkflowActionIdentifier, 'is.workflow.actions.openin');
  assert.equal(action.WFWorkflowActionParameters.WFOpenInAppIdentifier, 'com.anonymous.gasfinder');
  const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(action.WFWorkflowActionParameters.WFOpenInAppIdentifier, app.expo.ios.bundleIdentifier);
  assert.equal(action.WFWorkflowActionParameters.WFInput.Value.Type, 'ExtensionInput');
  const signed = JSON.parse(await readFile(new URL('../assets/shortcuts/import-statement.signed.json', import.meta.url), 'utf8'));
  assert.equal(signed.filename, 'GasFinder Import Statement.shortcut');
  assert.equal(Buffer.from(signed.base64, 'base64').subarray(0, 4).toString(), 'AEA1');
});
