import assert from 'node:assert/strict';
import test from 'node:test';
import { pauseActivityProps, reconcilePauseActivities } from '../src/features/spending/widgetLogic.ts';

const now = 1_800_000_000_000;
const item = { id: 'wait', name: 'Private purchase', amount: 99, status: 'waiting', createdAt: now, reviewAt: now + 86_400_000 };
const instance = () => { const calls = []; return { calls, end: async policy => calls.push(['end', policy]), update: async props => calls.push(['update', props]) }; };

test('Live Activity payload omits purchase name/price and points to the captured review deadline', () => {
  const props = pauseActivityProps(item);
  assert.equal(props.name, 'Purchase waiting list'); assert.equal(props.reviewAt, item.reviewAt);
  assert.equal(props.amount, undefined); assert.equal(JSON.stringify(props).includes(item.name), false);
});

test('Relaunch refreshes one existing activity without starting another and ends extras', async () => {
  const first = instance(), extra = instance();
  await reconcilePauseActivities([first, extra], item.id, [item], now);
  assert.equal(first.calls[0][0], 'update'); assert.deepEqual(extra.calls, [['end', 'immediate']]);
  await reconcilePauseActivities([], item.id, [item], now); // No implicit restart after iOS dismisses it.
});

test('Removing, buying, skipping, stopping or reaching the review deadline ends the activity', async () => {
  for (const [tracked, items, time] of [[item.id, [], now], [item.id, [{ ...item, status: 'bought' }], now],
    [item.id, [{ ...item, status: 'skipped' }], now], [null, [item], now], [item.id, [item], item.reviewAt]]) {
    const activity = instance(); await reconcilePauseActivities([activity], tracked, items, time);
    assert.deepEqual(activity.calls, [['end', 'immediate']]);
  }
});
