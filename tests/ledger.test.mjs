import assert from 'node:assert/strict';
import test from 'node:test';

import { removeDemoPayment, removeDemoWithdrawal } from '../src/features/investing/ledger.ts';

const payment = { id: 'p1', amount: 40, surcharge: 2.35, method: 'debit', createdAt: '2026-09-28T12:00:00Z', destination: 'cash', contributionOption: 'fixed' };
const withdrawal = { id: 'w1', amount: 1.5, destination: 'cash', createdAt: '2026-09-28T13:00:00Z' };

test('removing an available demo contribution updates its destination balance', () => {
  const ledger = { payments: [payment], withdrawals: [], cashBalance: 2.35, investedBalance: 3, withdrawnTotal: 0 };
  const result = removeDemoPayment(ledger, 'p1');
  assert.deepEqual(result, { payments: [], cashBalance: 0 });
  assert.equal(ledger.cashBalance, 2.35);
});

test('a withdrawn contribution cannot be removed until its withdrawal is restored', () => {
  const ledger = { payments: [payment], withdrawals: [withdrawal], cashBalance: 0.85, investedBalance: 0, withdrawnTotal: 1.5 };
  assert.equal(removeDemoPayment(ledger, 'p1'), null);
  const restored = { ...ledger, ...removeDemoWithdrawal(ledger, 'w1') };
  assert.equal(restored.cashBalance, 2.35);
  assert.equal(restored.withdrawnTotal, 0);
  assert.deepEqual(removeDemoPayment(restored, 'p1'), { payments: [], cashBalance: 0 });
});

test('missing entries leave the ledger unchanged', () => {
  const ledger = { payments: [payment], withdrawals: [withdrawal], cashBalance: 0.85, investedBalance: 0, withdrawnTotal: 1.5 };
  assert.equal(removeDemoPayment(ledger, 'missing'), null);
  assert.equal(removeDemoWithdrawal(ledger, 'missing'), null);
});
