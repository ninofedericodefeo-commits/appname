import test from 'node:test';
import assert from 'node:assert/strict';
import { fuelReports, parseFuelDetails, receiptAccountCandidates, reportAccountTransaction } from '../src/features/fuel/logic.ts';
import { fuelStatistics } from '../src/features/fuel/statistics.ts';
import { receiptTextCandidates } from '../src/features/receipts/textCandidates.ts';
import { withLocalPrices, localPriceHistory } from '../src/features/stations/localPrices.ts';
import { filterPricedStations } from '../src/features/stations/logic.ts';
const now = new Date(2026, 9, 14, 12);
const input = { stationName: 'Synthetic Shell', stationAddress: 'Test street', latitude: '40', longitude: '-75', price: '3.199', gallons: '10.000', total: '31.99', observedOn: '2026-10-14', observedTime: '11:00', qualifier: 'standard', odometer: '', fullFill: false, completeFillInterval: false, acknowledgeAdjustment: false };
const report = (id, date, extra = {}) => ({ id, stationName: 'Synthetic Shell', stationAddress: 'Test street', fuelType: 'regular', photoUri: '', pricePerGallon: 3.199, purchasedOn: date, observedAt: `${date}T11:00:00Z`, savedAt: `${date}T12:00:00Z`, locationSource: 'map', coordinates: { latitude: 40, longitude: -75 }, stationId: 'station', ...extra });
test('Refill arithmetic uses integer units and retains explicit fees/discounts after review', () => {
  assert.equal(parseFuelDetails(input, now).totalCents, 3199); assert.equal(parseFuelDetails(input, now).adjustmentCents, 0);
  assert.throws(() => parseFuelDetails({ ...input, total: '33.99' }, now), /fees or discounts/);
  assert.equal(parseFuelDetails({ ...input, total: '33.99', acknowledgeAdjustment: true }, now).adjustmentCents, 200);
  assert.equal(parseFuelDetails({ ...input, total: '30.99', acknowledgeAdjustment: true }, now).adjustmentCents, -100);
  assert.throws(() => parseFuelDetails({ ...input, gallons: '', fullFill: true }, now), /gallons/);
  assert.throws(() => parseFuelDetails({ ...input, observedOn: '2026-10-15' }, now), /future/);
  assert.throws(() => parseFuelDetails({ ...input, observedOn: '2026-02-31' }, now), /valid observation/);
});
test('Map prices and history compare the selected price type and exclude Trash without rewriting observations', () => {
  const standard = report('std', '2026-10-14'), cash = report('cash', '2026-10-14', { pricePerGallon: 2.899, priceQualifier: 'cash' }), trashed = report('trash', '2026-10-14', { pricePerGallon: 1.999, trashedAt: now.toISOString() });
  const stations = [{ id: 'station', prices: [], name: 'Shell', latitude: 40, longitude: -75, address: '', city: '', state: '' }];
  assert.equal(withLocalPrices(stations, [standard, cash, trashed], [])[0].prices[0].price, 3.199);
  assert.equal(withLocalPrices(stations, [standard, cash, trashed], [], 'cash')[0].prices[0].price, 2.899);
  assert.equal(localPriceHistory('station', 'regular', 'all', [standard, cash, trashed], [], now.getTime(), 'cash').length, 1);
  const old = withLocalPrices(stations, [report('old', '2026-09-01')], []);
  assert.equal(filterPricedStations(old, 'regular', false, true, now.getTime()).length, 0);
  assert.equal(filterPricedStations(old, 'regular', true, false, now.getTime()).length, 1);
});
test('Equal real charges remain distinct candidates; linking a later bank row to a local purchase counts one expense', () => {
  const rows = ['one', 'two'].map(id => ({ id, title: 'Shell', source: 'citizens-pdf', amountCents: -3199, occurredAt: '2026-10-14T12:00:00Z', status: 'posted', accountLabel: 'Checking' }));
  assert.equal(receiptAccountCandidates(rows, 3199, '2026-10-14T11:00:00Z').length, 2);
  const bank = { ...rows[0], linkedPurchaseId: 'wallet-one' };
  assert.equal(reportAccountTransaction({ accountLink: { kind: 'purchase', id: 'wallet-one' } }, [bank]).id, 'one');
  const receipts = fuelReports([report('a', '2026-10-14', { totalCents: 3199, gallons: 10, accountLink: { kind: 'purchase', id: 'wallet-one' } }), report('b', '2026-10-14', { totalCents: 3199, gallons: 10, accountLink: { kind: 'transaction', id: 'one' } }), report('c', '2026-10-14', { totalCents: 3199, gallons: 10, accountLink: { kind: 'transaction', id: 'two' } })], []);
  const stats = fuelStatistics(receipts, [bank, rows[1]]);
  assert.equal(stats.spentCents, 6398); assert.equal(stats.fillCount, 2); assert.equal(stats.duplicateLinkedReports, 1);
});
test('Measured MPG needs two full endpoints, complete coverage and every intervening volume', () => {
  const receipts = [report('start', '2026-10-01', { carId: 'car', gallons: 10, totalCents: 3199, fullFill: true, odometerMiles: 1000 }), report('partial', '2026-10-05', { carId: 'car', gallons: 2, totalCents: 640 }), report('end', '2026-10-14', { carId: 'car', gallons: 8, totalCents: 2559, fullFill: true, odometerMiles: 1300, completeFillInterval: true })];
  assert.equal(fuelStatistics(fuelReports(receipts, []), [], 'car').measuredMpg, 30);
  assert.equal(fuelStatistics(fuelReports(receipts.map(item => item.id === 'end' ? { ...item, completeFillInterval: false } : item), []), [], 'car').measuredMpg, null);
  assert.equal(fuelStatistics(fuelReports(receipts.map(item => item.id === 'partial' ? { ...item, gallons: undefined } : item), []), [], 'car').measuredMpg, null);
  assert.equal(fuelStatistics(fuelReports([receipts[1]], []), [], 'car').measuredMpg, null);
});
test('Receipt text extraction uses labeled fields, skips card numbers/subtotals and leaves conflicting totals for review', () => {
  const lines = ['SYNTHETIC GAS', '10/14/2026', 'REGULAR', 'PRICE/GAL $3.199', 'Volume 10.000', 'Subtotal 31.99', 'TOTAL $31.99', 'VISA 1234567890123456', 'AUTH 123456'].map(text => ({ text, confidence: .99 }));
  const values = receiptTextCandidates(lines, now);
  assert.equal(values.price.value, '3.199'); assert.equal(values.gallons.value, '10.000'); assert.equal(values.total.value, '31.99'); assert.equal(values.observedOn.value, '2026-10-14'); assert.equal(values.stationName.uncertain, true);
  assert.equal(receiptTextCandidates([...lines, { text: 'TOTAL $40.00', confidence: .99 }], now).total, undefined);
  assert.equal(receiptTextCandidates([{ text: 'VISA 1234 $31.99', confidence: .99 }], now).total, undefined);
  assert.equal(receiptTextCandidates([{ text: 'PRICE/GAL 3.199', confidence: .3 }], now).price.uncertain, true);
});
