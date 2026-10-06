import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_SET_ASIDE_RULE,
  automaticSetAsideCents,
  canLogPurchase,
  canReleaseFromGoal,
  canReleaseUnassigned,
  canSetAsideForGoal,
  progressPercent,
  ruleAmountCents,
  ruleDescription,
  startingGoalCents,
  suggestAmounts,
  validDeadline,
  validSetAsideRule,
} from '../src/features/goals/logic.ts';

const now = new Date('2026-09-29T12:00:00Z');
const goal = { id: 'goal', title: 'Bike', kind: 'item', targetCents: 10000, savedCents: 2000, deadline: null, createdAt: now.toISOString() };
const purchase = { id: 'new', title: 'Lunch', amountCents: 4000, purchasedAt: now.toISOString(), decision: 'pending' };

test('goal date and percent never mark an unfinished goal complete', () => {
  assert.equal(validDeadline('2026-10-01', now), true);
  assert.equal(validDeadline('2026-09-29', now), false);
  assert.equal(validDeadline('2027-02-30', now), false);
  assert.equal(progressPercent({ ...goal, savedCents: 9999 }), 99);
});

test('existing pocket assignment is all or none and releases respect goal allocation', () => {
  assert.equal(startingGoalCents(3500, false), 0);
  assert.equal(startingGoalCents(3500, true), 3500);
  assert.equal(canReleaseUnassigned(1500, 3500, { ...goal, savedCents: 2000 }), true);
  assert.equal(canReleaseUnassigned(1501, 3500, { ...goal, savedCents: 2000 }), false);
  assert.equal(canReleaseFromGoal(2001, goal), false);
  assert.equal(canReleaseFromGoal(2000, goal), true);
  assert.equal(canSetAsideForGoal(500, goal, 4000, 3500), true);
  assert.equal(canSetAsideForGoal(501, goal, 4000, 3500), false);
  assert.equal(canSetAsideForGoal(8001, goal, null, 3500), false);
});

test('a Spending Pause purchase cannot be logged twice', () => {
  const history = [{ ...purchase, id: 'logged', sourcePauseId: 'pause-1' }];
  assert.equal(canLogPurchase('new', 'Lunch', 4000, 'pause-1', history), false);
  assert.equal(canLogPurchase('logged', 'Lunch', 4000, undefined, history), false);
  assert.equal(canLogPurchase('new', 'Lunch', 4000, 'pause-2', history), true);
});

test('sparse spending history gives a bounded five-percent starting suggestion', () => {
  const result = suggestAmounts({ purchase, history: [], goal, settings: DEFAULT_GOAL_SETTINGS, now });
  assert.equal(result.sparse, true);
  assert.deepEqual(result.amounts, [100, 200, 300]);
  assert.deepEqual(suggestAmounts({ purchase, history: [], goal: { ...goal, savedCents: 9990 }, settings: DEFAULT_GOAL_SETTINGS, now }).amounts, [10]);
});

test('history and a deadline affect suggestions without exceeding either cap', () => {
  const history = [1, 2, 3, 4, 5, 6].map((day) => ({ ...purchase, id: `old-${day}`, amountCents: 2000 + day * 100, purchasedAt: `2026-09-${String(day + 19).padStart(2, '0')}T12:00:00Z` }));
  const untimed = suggestAmounts({ purchase, history, goal, settings: DEFAULT_GOAL_SETTINGS, now });
  assert.equal(untimed.sparse, false);
  assert.ok(untimed.amounts.every((amount) => amount <= 400));
  const timed = suggestAmounts({ purchase, history, goal: { ...goal, deadline: '2026-10-01' }, settings: DEFAULT_GOAL_SETTINGS, now });
  assert.equal(timed.paceLimited, true);
  assert.deepEqual(timed.amounts, [400]);
  assert.deepEqual(suggestAmounts({ purchase, history, goal, settings: { ...DEFAULT_GOAL_SETTINGS, suggestionsEnabled: false }, now }).amounts, []);
});

test('fixed, percent and round-up rules use cents and reject invalid values', () => {
  assert.equal(ruleAmountCents(1250, { mode: 'fixed', cents: 200 }), 200);
  assert.equal(ruleAmountCents(1250, DEFAULT_SET_ASIDE_RULE), 63);
  assert.equal(ruleAmountCents(1250, { mode: 'round', incrementCents: 500 }), 250);
  assert.equal(ruleAmountCents(1500, { mode: 'round', incrementCents: 500 }), 0);
  assert.equal(validSetAsideRule({ mode: 'percent', percent: 101 }), false);
  assert.equal(ruleDescription({ mode: 'round', incrementCents: 100 }), 'Round each purchase up to the next $1');
});

test('automatic pocket set-asides respect the goal remainder and entered balance', () => {
  const usingRule = { ...goal, setAsideRule: { mode: 'fixed', cents: 500 } };
  assert.equal(automaticSetAsideCents(2500, usingRule, null, 2000), 500);
  assert.equal(automaticSetAsideCents(2500, { ...usingRule, savedCents: 9900 }, null, 9900), 100);
  assert.equal(automaticSetAsideCents(2500, usingRule, 2200, 2000), 200);
  assert.equal(automaticSetAsideCents(2500, usingRule, 2000, 2000), 0);
});
