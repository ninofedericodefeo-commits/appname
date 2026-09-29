import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReceiptDetails } from '../src/features/receipts/validation.ts';
import { availableCents, canReserve, parseDollars } from '../src/features/pocket/logic.ts';

const receipt = { stationName: 'Main Street Fuel', stationAddress: '123 Main St', priceInput: '3.199', gallonsInput: '10', totalInput: '31.99', purchasedOn: '2026-09-01', hasCoordinates: false };

test('receipt report accepts a matching price, volume, and total', () => {
  assert.equal(parseReceiptDetails(receipt).value?.pricePerGallon, 3.199);
});

test('receipt report requires a location and rejects mismatched totals', () => {
  assert.match(parseReceiptDetails({ ...receipt, stationAddress: '' }).error, /address/);
  assert.match(parseReceiptDetails({ ...receipt, totalInput: '100' }).error, /differ/);
  assert.match(parseReceiptDetails({ ...receipt, purchasedOn: '2026-02-30' }).error, /valid purchase date/);
});

test('pocket math bounds earmarks to entered balance', () => {
  assert.equal(parseDollars('25.50'), 2550);
  assert.equal(parseDollars('0'), 0);
  assert.equal(parseDollars('1.234'), null);
  assert.equal(availableCents(10000, 3500), 6500);
  assert.equal(canReserve(6500, 10000, 3500), true);
  assert.equal(canReserve(6501, 10000, 3500), false);
});
