import assert from 'node:assert/strict';
import test from 'node:test';
import { endRetiredActivities } from '../src/features/spending/widgetLogic.ts';

test('Removing the waiting list dismisses every existing activity immediately', async () => {
  const ended = [];
  await endRetiredActivities([0, 1].map(id => ({ end: async policy => ended.push([id, policy]) })));
  assert.deepEqual(ended, [[0, 'immediate'], [1, 'immediate']]);
  await endRetiredActivities([]);
});

test('A failed dismissal does not leave the other retired activities running', async () => {
  let ended = false;
  await assert.rejects(endRetiredActivities([{ end: () => { throw Error('iOS refused'); } }, { end: async () => { ended = true; } }]), /dismiss/);
  assert.equal(ended, true);
});
