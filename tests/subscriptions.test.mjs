import assert from 'node:assert/strict';
import test from 'node:test';

import { localDateKey, nextRenewal, subscriptionsToReviewTomorrow, upcomingReminderGroups } from '../src/features/subscriptions/logic.ts';

const monthly = { id: 'm', name: 'Music', amountCents: 1099, cadence: 'monthly', day: 1, month: 1, active: true };

test('a first-of-month renewal is reviewed on the previous month’s last day', () => {
  const today = new Date(2026, 0, 31, 12);
  assert.equal(localDateKey(nextRenewal(monthly, today)), '2026-02-01');
  assert.deepEqual(subscriptionsToReviewTomorrow([monthly], today).map(({ subscription }) => subscription.id), ['m']);
  const groups = upcomingReminderGroups([monthly], new Date(2026, 0, 30, 12));
  assert.equal(localDateKey(groups[0].at), '2026-01-31');
  assert.equal(groups[0].at.getHours(), 9);
});

test('31st renewals use the last day of shorter months, including leap years', () => {
  const endOfMonth = { ...monthly, day: 31 };
  assert.equal(localDateKey(nextRenewal(endOfMonth, new Date(2026, 1, 1, 12))), '2026-02-28');
  assert.equal(localDateKey(nextRenewal(endOfMonth, new Date(2028, 1, 1, 12))), '2028-02-29');
  assert.equal(localDateKey(nextRenewal(endOfMonth, new Date(2026, 1, 28, 12))), '2026-02-28');
});

test('yearly renewals roll to the next year and completed reviews do not repeat', () => {
  const annual = { ...monthly, id: 'a', cadence: 'yearly', month: 3, day: 1 };
  assert.equal(localDateKey(nextRenewal(annual, new Date(2026, 2, 2, 12))), '2027-03-01');
  const today = new Date(2027, 1, 28, 12);
  assert.equal(subscriptionsToReviewTomorrow([annual], today).length, 1);
  assert.equal(subscriptionsToReviewTomorrow([{ ...annual, lastReview: { renewalDate: '2027-03-01', decision: 'keep', decidedAt: '' } }], today).length, 0);
});

test('same-day reminders combine prices and inactive subscriptions are excluded', () => {
  const second = { ...monthly, id: 'v', name: 'Video', amountCents: 1500 };
  const inactive = { ...monthly, id: 'x', active: false, amountCents: 9999 };
  const groups = upcomingReminderGroups([monthly, second, inactive], new Date(2026, 0, 30, 12));
  assert.equal(groups[0].totalCents, 2599);
  assert.deepEqual(groups[0].names, ['Music', 'Video']);
});
