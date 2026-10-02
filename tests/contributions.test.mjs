import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateContribution } from '../src/features/investing/calculations.ts';

const defaults = { amount: 45.34, fixedAmount: '', feePercent: 0.5, maxExtraPayment: 5, roundingIncrement: 1 };

test('rounding uses cents for each configured increment', () => {
  assert.equal(calculateContribution({ ...defaults, option: 'round-up' }), 0.66);
  assert.equal(calculateContribution({ ...defaults, option: 'round-up', roundingIncrement: 10, maxExtraPayment: 100 }), 4.66);
  assert.equal(calculateContribution({ ...defaults, option: 'round-up', roundingIncrement: 100, maxExtraPayment: 100 }), 54.66);
});

test('a completed increment contributes zero', () => {
  assert.equal(calculateContribution({ ...defaults, amount: 50, option: 'round-up', roundingIncrement: 10 }), 0);
});

test('fees and fixed amounts respect the cap', () => {
  assert.equal(calculateContribution({ ...defaults, option: 'fee' }), 0.23);
  assert.equal(calculateContribution({ ...defaults, option: 'fee', feePercent: 20 }), 5);
  assert.equal(calculateContribution({ ...defaults, option: 'fixed', fixedAmount: '12.31' }), 5);
});

test('invalid fixed input and no-extra choice contribute zero', () => {
  assert.equal(calculateContribution({ ...defaults, option: 'fixed', fixedAmount: 'oops' }), 0);
  assert.equal(calculateContribution({ ...defaults, option: 'none' }), 0);
});
