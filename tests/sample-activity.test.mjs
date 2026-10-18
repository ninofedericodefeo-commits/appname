import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCars, sampleFillups, sampleFuelStatistics, samplePastGoals, sampleSpendingSummary } from '../src/features/samples/activityFixtures.ts';
import { validateCar } from '../src/features/vehicles/logic.ts';
import { fuelStatistics } from '../src/features/fuel/statistics.ts';
import { sampleTransactions, SAMPLE_CLOSING_BALANCE_CENTS, SAMPLE_OPENING_BALANCE_CENTS } from '../src/features/samples/fixtures.ts';

test('sample driving history supports a real MPG calculation without creating account links', () => {
  const car = sampleCars()[0];
  assert.deepEqual(validateCar(car), car);
  const fills = sampleFillups();
  for (const fill of fills) {
    assert.equal(fill.carId, car.id);
    assert.equal(fill.isSample, true);
    assert.ok(fill.id.startsWith('sample-'));
    assert.equal(fill.accountLink, undefined);
    assert.equal(fill.totalCents, Math.round(fill.price * fill.gallons * 100) + fill.adjustmentCents);
  }
  const stats = sampleFuelStatistics();
  assert.equal(stats.segments.length, 2);
  assert.equal(stats.measuredMiles, 661);
  assert.equal(stats.measuredMpg, 661 / 21);
  assert.equal(stats.spentCents, fills.reduce((sum, fill) => sum + fill.totalCents, 0));
  assert.equal(fuelStatistics([], []).spentCents, 0);
});

test('sample insights reconcile to the synthetic statement and exclude its savings transfer', () => {
  const summary = sampleSpendingSummary();
  assert.equal(summary.transferCents, -25000);
  assert.equal(summary.spendingCents, 20446);
  assert.equal(summary.incomeCents - summary.spendingCents + summary.transferCents, SAMPLE_CLOSING_BALANCE_CENTS - SAMPLE_OPENING_BALANCE_CENTS);
  assert.equal(Object.values(summary.categories).reduce((sum, cents) => sum + cents, 0), summary.spendingCents);
  assert.ok(summary.selected.every(row => row.isSample));
  assert.ok(sampleTransactions().every(row => row.details === undefined), 'annotation must not mutate source fixtures');
});

test('sample fixtures return independent records and past goals do not change live progress', () => {
  const car = sampleCars()[0]; car.mpg = 1;
  const fill = sampleFillups()[0]; fill.totalCents = 1;
  const goal = samplePastGoals()[0]; goal.savedCents = 0;
  assert.equal(sampleCars()[0].mpg, 32);
  assert.equal(sampleFillups()[0].totalCents, 4299);
  assert.equal(samplePastGoals()[0].savedCents, samplePastGoals()[0].targetCents);
});
