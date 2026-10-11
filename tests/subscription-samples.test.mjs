import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceSampleSubscriptions, sampleSubscriptions } from '../src/features/subscriptions/samples.ts';
import { addCalendarDays, localDateKey, nextRenewal, subscriptionsToReviewTomorrow } from '../src/features/subscriptions/logic.ts';

test('Samples exercise tomorrow review across month/year boundaries and never claim bank evidence', () => {
  for (const now of [new Date(2026, 9, 11, 12), new Date(2026, 11, 31, 12), new Date(2028, 1, 28, 12)]) {
    const samples = sampleSubscriptions(now);
    assert.equal(samples.length, 3); assert.equal(new Set(samples.map(item => item.id)).size, 3);
    const due = subscriptionsToReviewTomorrow(samples, now);
    assert.equal(due.length, 1); assert.equal(due[0].subscription.id, 'sample-music');
    assert.equal(localDateKey(due[0].renewal), localDateKey(addCalendarDays(now, 1)));
    assert.equal(localDateKey(nextRenewal(samples[2], now)), localDateKey(addCalendarDays(now, 7)));
    for (const sample of samples) { assert.equal(sample.isSample, true); assert.equal(sample.bankMerchantKey, undefined); }
  }
});

test('Reset replaces samples once, preserves real entries and clears completed sample reviews', () => {
  const now = new Date(2026, 9, 11, 12);
  const real = { ...sampleSubscriptions(now)[0], id: 'real-music', isSample: undefined, bankMerchantKey: 'verified' };
  const first = replaceSampleSubscriptions([real], now);
  first[1].lastReview = { renewalDate: localDateKey(addCalendarDays(now, 1)), decision: 'keep', decidedAt: now.toISOString() };
  assert.equal(subscriptionsToReviewTomorrow(first.filter(item => item.isSample), now).length, 0);
  const reset = replaceSampleSubscriptions(first, now);
  assert.equal(reset.length, 4); assert.equal(reset[0], real);
  assert.equal(reset[1].lastReview, undefined);
  assert.deepEqual(reset.filter(item => !item.isSample), [real]);
  assert.equal(subscriptionsToReviewTomorrow(reset.filter(item => item.isSample), now).length, 1);
});
