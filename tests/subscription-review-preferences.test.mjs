import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSampleSnoozes, migrateReviewPreferences, pendingRenewalReviews, renewalReviewKey, snoozeRenewalReviews, subscriptionsForMode } from '../src/features/subscriptions/reviewPreferences.ts';
import { upcomingReminderGroups } from '../src/features/subscriptions/logic.ts';
import { sampleSubscriptions } from '../src/features/subscriptions/samples.ts';
import { describeReminderStatus } from '../src/features/subscriptions/reminderStatus.ts';

const now = new Date(2026, 9, 13, 10);
const real = { id: 'real', name: 'Music', amountCents: 1099, cadence: 'monthly', day: 14, month: 10, active: true };
const all = [real, ...sampleSubscriptions(now)];

test('Normal mode hides samples and test mode includes them, without scheduling sample phone notifications', () => {
  assert.deepEqual(subscriptionsForMode(all, false), [real]);
  assert.equal(subscriptionsForMode(all, true).length, 4);
  assert.equal(pendingRenewalReviews(all, false, {}, now).length, 1);
  assert.equal(pendingRenewalReviews(all, true, {}, now).length, 2);
  const groups = upcomingReminderGroups(all, now);
  assert.ok(groups.length); assert.ok(groups.every(group => group.names.length === 1 && group.names[0] === 'Music'));
  assert.deepEqual(upcomingReminderGroups(sampleSubscriptions(now), now), []);
});

test('Two-hour snoozes survive serialized reload/foregrounding and expire exactly at their deadline', () => {
  const snoozes = JSON.parse(JSON.stringify(snoozeRenewalReviews(all, true, {}, 'two-hours', now)));
  assert.equal(pendingRenewalReviews(all, true, snoozes, new Date(2026, 9, 13, 11, 59)).length, 0);
  assert.equal(pendingRenewalReviews(all, true, snoozes, new Date(2026, 9, 13, 12)).length, 2);
  assert.equal(pendingRenewalReviews(all, true, {}, now).length, 2); // Explicit resume.
});

test('Snoozing today uses local midnight and cannot suppress the next renewal period', () => {
  const snoozes = snoozeRenewalReviews([real], false, {}, 'today', now);
  const key = renewalReviewKey(real.id, new Date(2026, 9, 14, 12));
  const until = new Date(snoozes[key].until);
  assert.equal(until.getHours(), 0); assert.equal(until.getDate(), 14);
  assert.equal(pendingRenewalReviews([real], false, snoozes, new Date(2026, 9, 13, 23, 59)).length, 0);
  snoozes[key].until = new Date(2026, 11, 1).toISOString();
  assert.equal(pendingRenewalReviews([real], false, snoozes, new Date(2026, 10, 13, 10)).length, 1);
});

test('New subscriptions, edited prices and changed dates get a new review despite an older snooze', () => {
  const snoozes = snoozeRenewalReviews([real], false, {}, 'today', now);
  assert.equal(pendingRenewalReviews([real, { ...real, id: 'new' }], false, snoozes, now).length, 1);
  assert.equal(pendingRenewalReviews([{ ...real, amountCents: 1299 }], false, snoozes, now).length, 1);
  assert.equal(pendingRenewalReviews([{ ...real, day: 15 }], false, snoozes, new Date(2026, 9, 14, 10)).length, 1);
  const reviewed = { ...real, lastReview: { renewalDate: '2026-10-14', decision: 'keep', decidedAt: now.toISOString() } };
  assert.equal(pendingRenewalReviews([reviewed], false, {}, now).length, 0);
});

test('Test-mode migration preserves existing sample testing and clearing/resetting samples retains real snoozes', () => {
  assert.equal(migrateReviewPreferences({ subscriptions: all }).sampleMode, true);
  assert.equal(migrateReviewPreferences({ subscriptions: [real] }).sampleMode, false);
  assert.equal(migrateReviewPreferences({ subscriptions: all, sampleMode: false }).sampleMode, false);
  const snoozes = snoozeRenewalReviews(all, true, {}, 'today', now);
  const cleared = clearSampleSnoozes(all, snoozes);
  assert.equal(Object.keys(cleared).length, 1);
  assert.equal(pendingRenewalReviews(all, true, cleared, now)[0].subscription.id, 'sample-music');
  assert.equal(pendingRenewalReviews(all, false, cleared, now).length, 0);
});

test('Reminder descriptions distinguish permission, actual scheduling and off preferences with uncleared entries', () => {
  const scheduled = { permission: 'granted', scheduledCount: 3, expectedCount: 3 };
  assert.match(describeReminderStatus(true, scheduled).label, /3 renewal reminders scheduled/);
  assert.equal(describeReminderStatus(true, { ...scheduled, scheduledCount: 2 }).needsRefresh, true);
  assert.equal(describeReminderStatus(false, scheduled).needsRefresh, true);
  assert.match(describeReminderStatus(true, { ...scheduled, permission: 'denied' }).label, /Blocked/);
  assert.match(describeReminderStatus(true, { ...scheduled, permission: 'undetermined' }).label, /not been granted/);
  assert.match(describeReminderStatus(true, { ...scheduled, permission: 'quiet' }).label, /quietly/);
  assert.match(describeReminderStatus(true, { ...scheduled, permission: 'unavailable' }).label, /phone app/);
});
