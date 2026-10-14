import assert from 'node:assert/strict';
import test from 'node:test';
import { previewSavingsAdjustment } from '../src/features/goals/savingsAdjustment.ts';

const state = { activeGoal: { id: 'trip', title: 'Trip', targetCents: 10000, savedCents: 2000 }, reservedCents: 5000, estimatedBalanceCents: 10000 };

test('Goal contributions change progress and total set-aside together, preserving unassigned money and the bank estimate', () => {
  const original = structuredClone(state);
  const next = previewSavingsAdjustment(state, 'goal', 'add', 1000, 'trip');
  assert.equal(next.error, null); assert.equal(next.assignedAfterCents, 3000); assert.equal(next.reservedAfterCents, 6000);
  assert.equal(next.reservedAfterCents - next.assignedAfterCents, 3000); assert.equal(next.availableAfterCents, 4000);
  assert.deepEqual(state, original);
});

test('Unassigned contributions preserve goal progress and cannot release assigned savings', () => {
  const add = previewSavingsAdjustment(state, 'unassigned', 'add', 1000);
  assert.equal(add.assignedAfterCents, 2000); assert.equal(add.destinationBeforeCents, 3000); assert.equal(add.destinationAfterCents, 4000);
  assert.match(previewSavingsAdjustment(state, 'unassigned', 'lower', 3001).error, /unassigned/);
  const lower = previewSavingsAdjustment(state, 'unassigned', 'lower', 3000);
  assert.equal(lower.reservedAfterCents, 2000); assert.equal(lower.assignedAfterCents, 2000); assert.equal(lower.availableAfterCents, 8000);
});

test('Lowering goal savings increases available money while preserving the unassigned part', () => {
  const lower = previewSavingsAdjustment(state, 'goal', 'lower', 2000, 'trip');
  assert.equal(lower.assignedAfterCents, 0); assert.equal(lower.reservedAfterCents, 3000); assert.equal(lower.availableAfterCents, 7000);
  assert.equal(lower.reservedAfterCents - lower.assignedAfterCents, 3000);
  assert.match(previewSavingsAdjustment(state, 'goal', 'lower', 2001).error, /assigned/);
});

test('Live balance/goal changes invalidate a previously possible contribution', () => {
  assert.equal(previewSavingsAdjustment(state, 'goal', 'add', 1000, 'trip').error, null);
  assert.ok(previewSavingsAdjustment({ ...state, estimatedBalanceCents: 5500 }, 'goal', 'add', 1000, 'trip').error);
  assert.ok(previewSavingsAdjustment({ ...state, activeGoal: { ...state.activeGoal, savedCents: 9500 } }, 'goal', 'add', 1000, 'trip').error);
  assert.match(previewSavingsAdjustment({ ...state, activeGoal: { ...state.activeGoal, id: 'new-goal' } }, 'goal', 'add', 1000, 'trip').error, /changed/);
  assert.match(previewSavingsAdjustment({ ...state, activeGoal: null }, 'goal', 'add', 1000, 'trip').error, /changed/);
});

test('Unknown balance does not invent availability, and over-reserved money can still be lowered', () => {
  assert.equal(previewSavingsAdjustment({ ...state, estimatedBalanceCents: null }, 'goal', 'add', 1000).availableAfterCents, null);
  const overReserved = { ...state, estimatedBalanceCents: 1000 };
  assert.ok(previewSavingsAdjustment(overReserved, 'unassigned', 'add', 100).error);
  assert.equal(previewSavingsAdjustment(overReserved, 'unassigned', 'lower', 1000).availableAfterCents, -3000);
  for (const amount of [0, -1, 0.5, NaN, Infinity]) assert.ok(previewSavingsAdjustment(state, 'goal', 'add', amount).error);
});
