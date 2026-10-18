import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleNoticeDismissal } from '../src/features/notices/noticeTimer.ts';

function fakeClock() {
  const pending = new Map();
  let id = 0;
  return { pending, setTimeout(fn, delay) { pending.set(++id, { fn, delay }); return id; }, clearTimeout(id) { pending.delete(id); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('default timer adapters do not bind browser timer functions to the clock object', async () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let callback, cleared = false;
  try {
    globalThis.setTimeout = function (fn) { assert.equal(this, undefined); callback = fn; return 123; };
    globalThis.clearTimeout = function (id) { assert.equal(this, undefined); assert.equal(id, 123); cleared = true; };
    const cancel = scheduleNoticeDismissal(() => {}, 3000);
    await flush();
    assert.equal(typeof callback, 'function');
    cancel();
    assert.equal(cleared, true);
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});

test('passive notice dismisses after three seconds and honors a longer accessibility timeout', async () => {
  const clock = fakeClock();
  let count = 0;
  scheduleNoticeDismissal(() => count++, 3000, Promise.resolve(10000), clock);
  await flush();
  assert.equal(clock.pending.get(1).delay, 10000);
  clock.pending.get(1).fn();
  assert.equal(count, 1);
});

test('replacing a notice cancels the previous timer and starts a full new interval', async () => {
  const clock = fakeClock();
  const dismissed = [];
  const cancel = scheduleNoticeDismissal(() => dismissed.push('old'), 3000, Promise.resolve(3000), clock);
  await flush();
  const old = clock.pending.get(1);
  cancel();
  scheduleNoticeDismissal(() => dismissed.push('new'), 3000, Promise.resolve(3000), clock);
  await flush();
  old.fn();
  assert.deepEqual(dismissed, []);
  assert.equal(clock.pending.get(2).delay, 3000);
  clock.pending.get(2).fn();
  assert.deepEqual(dismissed, ['new']);
});

test('unmount before an accessibility lookup completes cannot schedule or dismiss a notice', async () => {
  const clock = fakeClock();
  let finish;
  let dismissed = false;
  const cancel = scheduleNoticeDismissal(() => { dismissed = true; }, 3000, new Promise(resolve => { finish = resolve; }), clock);
  cancel();
  finish(3000);
  await flush();
  assert.equal(clock.pending.size, 0);
  assert.equal(dismissed, false);
});

test('failed or shorter accessibility recommendations retain the minimum time', async () => {
  const clock = fakeClock();
  scheduleNoticeDismissal(() => {}, 5000, Promise.reject(new Error('Unavailable')), clock);
  scheduleNoticeDismissal(() => {}, 3000, Promise.resolve(10), clock);
  await flush();
  assert.deepEqual([...clock.pending.values()].map(timer => timer.delay).sort(), [3000, 5000]);
});
