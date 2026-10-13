import assert from 'node:assert/strict';
import test from 'node:test';
import { subscriptionBankAlerts, subscriptionBankEvidence } from '../src/features/subscriptions/bankEvidence.ts';
import { suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';
import { resolveLinkedAccount } from '../src/features/bank/accountIdentity.ts';
import { guessMapping, parseBankCSV, previewAccountTransactions } from '../src/features/bank/importLogic.ts';

const iso = day => new Date(`${day}T12:00:00`).toISOString();
const bank = (id, date, extra = {}) => ({ id, title: 'NETFLIX', amountCents: -1799, occurredAt: iso(date), source: 'citizens-pdf', status: 'posted', accountLabel: 'Checking', ...extra });
const subscription = extra => ({ id: 'netflix', name: 'My movies', bankMerchantKey: 'netflix', amountCents: 1699, active: true, cadence: 'monthly', day: 8, month: 1, createdAt: iso('2026-09-01'), ...extra });

test('History-only bank imports produce suggestions without requiring purchase/savings records', () => {
  const rows = [bank('one', '2026-07-08'), bank('two', '2026-08-08'), bank('three', '2026-09-08')];
  const evidence = subscriptionBankEvidence(rows, []);
  const suggestions = suggestBankSubscriptions(evidence, [], [], new Date('2026-10-01T12:00:00'));
  assert.equal(evidence.length, 3); assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].confidence, 'repeated'); assert.equal(suggestions[0].name, 'Netflix');
});

test('Evidence follows corrections, skips pending/deposits/explicit non-purchases and scopes the linked account', () => {
  const account = resolveLinkedAccount({ purchases: [], accountTransactions: [] }, 'Checking');
  const rows = [bank('charge', '2026-10-08'), bank('pending', '2026-10-08', { status: 'pending' }),
    bank('deposit', '2026-10-08', { amountCents: 1799 }), bank('mistake', '2026-10-08'),
    bank('other', '2026-10-08', { accountLabel: 'Savings' }), bank('fee', '2026-10-08', { transactionType: 'fee' }), bank('transfer', '2026-10-08', { transactionType: 'transfer' })];
  const evidence = subscriptionBankEvidence(rows, [], { mistake: 'in' }, account);
  assert.deepEqual(evidence.map(row => row.id), ['charge']);
});

test('A matched local log is one posted bank charge and a type-based recurring hint survives history-only import', () => {
  const purchase = { id: 'wallet', title: 'Streaming', amountCents: 1799, purchasedAt: iso('2026-10-07'), source: 'shortcut', decision: 'saved', savedCents: 90 };
  const evidence = subscriptionBankEvidence([bank('posted', '2026-10-08', { linkedPurchaseId: 'wallet' })], [purchase]);
  assert.equal(evidence.length, 1); assert.equal(evidence[0].id, 'posted'); assert.equal(evidence[0].title, 'NETFLIX');
  const legacy = subscriptionBankEvidence([], [{ ...purchase, bankSource: 'csv', bankDescription: 'NETFLIX', bankPostedAt: iso('2026-10-08') }]);
  assert.equal(legacy[0].title, 'NETFLIX'); assert.equal(legacy[0].purchasedAt, iso('2026-10-08'));
  const csv = parseBankCSV('Date,Description,Amount,Type\n10/08/2026,Gym,-30.00,Recurring');
  const ledger = previewAccountTransactions(csv, guessMapping(csv), 'Checking', new Date('2026-10-13T12:00:00')).rows;
  const suggestions = suggestBankSubscriptions(subscriptionBankEvidence(ledger, []), [], [], new Date('2026-10-13T12:00:00'));
  assert.equal(suggestions[0].name, 'Gym'); assert.equal(suggestions[0].confidence, 'possible');
});

test('Price alerts require a newer posted charge and use the newest charge after a saved price change', () => {
  const evidence = subscriptionBankEvidence([bank('new', '2026-10-08'), bank('older', '2026-09-08', { amountCents: -1599 })], []);
  const saved = subscription({});
  const alerts = subscriptionBankAlerts(evidence, [saved]);
  assert.equal(alerts.length, 1); assert.equal(alerts[0].kind, 'price-change'); assert.equal(alerts[0].charge.id, 'new');
  assert.equal(saved.amountCents, 1699); // Detection never changes the saved amount.
  assert.equal(subscriptionBankAlerts(evidence, [subscription({ amountCents: 1799 })]).length, 0);
  assert.equal(subscriptionBankAlerts(evidence, [subscription({ amountUpdatedAt: iso('2026-10-09') })]).length, 0);
  assert.equal(subscriptionBankAlerts(evidence, [subscription({ createdAt: iso('2026-10-08') })]).length, 0);
  assert.equal(subscriptionBankAlerts(evidence, [subscription({ createdAt: undefined })]).length, 0);
});

test('Canceled alerts ignore old/same-day charges, samples and plans to cancel; dismissals only cover the exact new charge', () => {
  const evidence = subscriptionBankEvidence([bank('after', '2026-10-08'), bank('same-day', '2026-10-07'), bank('before', '2026-09-08')], []);
  const canceled = subscription({ active: false, canceledAt: iso('2026-10-07') });
  const alerts = subscriptionBankAlerts(evidence, [canceled]);
  assert.equal(alerts.length, 1); assert.equal(alerts[0].kind, 'charge-after-cancel'); assert.equal(alerts[0].charge.id, 'after');
  assert.equal(canceled.active, false);
  assert.equal(subscriptionBankAlerts(evidence, [canceled], [alerts[0].id]).length, 0);
  const later = subscriptionBankEvidence([bank('different', '2026-10-09')], []);
  assert.equal(subscriptionBankAlerts(later, [canceled], [alerts[0].id]).length, 1);
  assert.equal(subscriptionBankAlerts(evidence, [{ ...canceled, isSample: true }]).length, 0);
  assert.equal(subscriptionBankAlerts(evidence, [subscription({ amountCents: 1799, lastReview: { decision: 'plan-to-cancel', renewalDate: '2026-10-08', decidedAt: iso('2026-10-07') } })]).length, 0);
});
