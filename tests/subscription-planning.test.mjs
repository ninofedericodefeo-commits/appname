import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, nextRenewal, upcomingCharges, subscriptionCosts, upcomingReminderGroups, validateSubscription } from '../src/features/subscriptions/logic.ts';
import { billingDestination, openCancellationDestination } from '../src/features/subscriptions/billing.ts';
import { subscriptionScheduleAlerts } from '../src/features/subscriptions/scheduleEvidence.ts';
import { subscriptionBankEvidence, subscriptionRefunds } from '../src/features/subscriptions/bankEvidence.ts';
const monthly = { id: 'music', name: 'Spotify', amountCents: 1000, cadence: 'monthly', day: 31, month: 1, active: true, createdAt: '2025-01-01T12:00:00Z' };
test('Real costs exclude canceled/sample records and distinguish an annual charge from monthly equivalent', () => {
  const now = new Date(2026, 0, 30, 12), annual = { ...monthly, id: 'annual', cadence: 'yearly', amountCents: 12000 };
  const all = [monthly, annual, { ...monthly, id: 'sample', isSample: true, amountCents: 999999 }, { ...monthly, id: 'inactive', active: false }];
  assert.deepEqual(subscriptionCosts(all, now), { annualCents: 24000, monthlyEquivalentCents: 2000, next7Cents: 13000, next30Cents: 14000, activeCount: 2 });
  assert.equal(upcomingCharges(all, now, 7).length, 2);
});
test('Calendar iteration does not drift from the 31st after a short month; leap-year trial becomes first paid renewal', () => {
  const dates = upcomingCharges([monthly], new Date(2026, 0, 1, 12), 100).map(item => item.dateKey);
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31']);
  const trial = { ...monthly, trialEndsOn: '2028-02-29', day: 29, month: 2 };
  assert.equal(localDateKey(nextRenewal(trial, new Date(2028, 0, 1, 12))), '2028-02-29');
  assert.deepEqual(upcomingCharges([trial], new Date(2028, 0, 1, 12), 100).map(item => item.dateKey), ['2028-02-29', '2028-03-29']);
  assert.throws(() => validateSubscription({ ...monthly, trialEndsOn: '2026-02-31' }));
});
test('Cancellation follow-up reminders persist after a renewal review and never schedule samples or canceled items', () => {
  const planned = { ...monthly, cancelBy: '2026-01-29', lastReview: { renewalDate: '2026-01-31', decision: 'plan-to-cancel' } };
  const groups = upcomingReminderGroups([planned, { ...planned, id: 'sample', isSample: true }, { ...planned, id: 'inactive', active: false }], new Date(2026, 0, 28, 12));
  assert.equal(localDateKey(groups[0].at), '2026-01-29'); assert.deepEqual(groups[0].cancelNames, ['Spotify']);
  assert.ok(!groups.some(group => localDateKey(group.at) === '2026-01-30'));
  const sameName = upcomingReminderGroups([monthly, { ...monthly, id: 'second', amountCents: 2000 }], new Date(2026, 0, 28, 12));
  assert.equal(sameName[0].totalCents, 3000); assert.equal(sameName[0].names.length, 2);
});
test('Billing channel wins over the installed app and opening a destination never changes active status', async () => {
  const sub = { ...monthly, billingChannel: 'apple', associatedApp: { name: 'Spotify', url: 'spotify:', fallbackUrl: 'https://www.spotify.com/account/' } };
  assert.match(billingDestination(sub, 'ios').url, /apps.apple.com/);
  assert.match(billingDestination({ ...sub, billingChannel: 'google' }, 'ios').url, /play.google.com/);
  assert.equal(billingDestination({ ...sub, billingChannel: 'website' }, 'ios').url, 'https://www.spotify.com/account/subscription/');
  const calls = [], before = structuredClone(sub);
  assert.equal((await openCancellationDestination(sub, async url => calls.push(url), 'ios')).opened, true);
  assert.deepEqual(sub, before); assert.equal(calls.length, 1);
  assert.equal((await openCancellationDestination(sub, async () => { throw Error('unavailable'); }, 'ios')).opened, false);
});
test('Schedule evidence needs three stable posted charges and tolerates small posting delays without changing the saved date', () => {
  const charge = (id, date) => ({ id, title: 'SPOTIFY', amountCents: 1000, purchasedAt: `${date}T12:00:00Z`, source: 'bank-import', decision: 'skipped' });
  const sub = { ...monthly, day: 1 };
  const delayed = [charge('a', '2026-01-03'), charge('b', '2026-02-03'), charge('c', '2026-03-03')];
  assert.equal(subscriptionScheduleAlerts(delayed, [sub]).length, 0);
  const changed = [charge('a', '2026-01-12'), charge('b', '2026-02-12'), charge('c', '2026-03-12')];
  assert.equal(subscriptionScheduleAlerts(changed.slice(1), [sub]).length, 0);
  const alerts = subscriptionScheduleAlerts(changed, [sub]); assert.equal(alerts.length, 1); assert.equal(alerts[0].day, 12); assert.equal(sub.day, 1);
  assert.equal(subscriptionScheduleAlerts(changed, [sub], [alerts[0].id]).length, 0);
  assert.equal(subscriptionScheduleAlerts(changed, [{ ...sub, scheduleUpdatedAt: '2026-03-13T12:00:00Z' }]).length, 0);
});
test('Reviewed transfer annotations remove subscription evidence and possible refunds remain separate credits', () => {
  const rows = [{ id: 'charge', title: 'NETFLIX', amountCents: -1799, occurredAt: '2026-10-08T12:00:00Z', source: 'citizens-pdf', status: 'posted', accountLabel: 'Checking' }, { id: 'refund', title: 'REFUND NETFLIX', amountCents: 1799, occurredAt: '2026-10-09T12:00:00Z', source: 'citizens-pdf', status: 'posted', accountLabel: 'Checking' }];
  assert.equal(subscriptionBankEvidence(rows, [], {}, null, { charge: { classification: 'transfer' } }).length, 0);
  assert.deepEqual(subscriptionRefunds(rows, []).map(row => [row.id, row.amountCents, row.merchantKey]), [['refund', 1799, 'netflix']]);
  assert.equal(rows[0].amountCents, -1799); assert.equal(rows[1].amountCents, 1799);
});

test('Older cancellation plans get a persistent due date without changing IDs or amounts', async () => {
  const { migrateSubscriptionPlanning } = await import('../src/features/subscriptions/logic.ts');
  const old = { ...monthly, lastReview: { renewalDate: '2026-01-31', decision: 'plan-to-cancel' } };
  const migrated = migrateSubscriptionPlanning(old, new Date(2026, 0, 28, 12));
  assert.equal(migrated.cancelBy, '2026-01-30'); assert.equal(migrated.id, old.id); assert.equal(migrated.amountCents, old.amountCents);
  assert.equal(migrateSubscriptionPlanning(old, new Date(2026, 1, 1, 12)).cancelBy, '2026-02-01');
  assert.equal(migrateSubscriptionPlanning({ ...old, cancelBy: '2026-01-29' }, new Date(2026, 1, 1, 12)).cancelBy, '2026-01-29');
});
