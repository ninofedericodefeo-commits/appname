import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reconcileStatement } from '../src/features/bank/statementReconciliation.ts';
import { extractPDFText } from '../src/features/bank/extractPDFText.ts';
import { parseCitizensStatement } from '../src/features/bank/citizensStatement.ts';

const period = '2026-09-01|2026-09-30';
const cell = (text, x, y) => ({ text, x, y, width: text.length * 5, height: 10 });
const line = (number, label, amount, x = 40) => ({ number, text: `${label} ${amount}`, items: [cell(label, x, number * 20), cell(amount, x + 200, number * 20)] });
const summary = (page = 1, range = period) => ({ page, period: range, lines: [line(1, 'Previous Balance', '100.00'), line(2, 'Total Withdrawals & Debits', '20.00'), line(3, 'Total Deposits & Credits', '30.00')] });
const csv = (rows, page = 2) => ({ headers: ['Date', 'Description', 'Debit', 'Credit'], rows, source: 'citizens-pdf', locations: rows.map((_, index) => ({ page, line: index + 1 })) });
const rows = [['09/08/2026', 'Store', '20.00', ''], ['09/09/2026', 'Payroll', '', '30.00']];
const closing = (amountCents = 11000, asOf = '2026-09-30') => ({ amountCents, asOf, page: 1, line: 4 });

test('Summary totals and opening-to-closing calculation match the full ledger', () => {
  const result = reconcileStatement([summary(), { page: 2, period, lines: [] }], csv(rows), [closing()]);
  assert.equal(result.status, 'matched'); assert.equal(result.debitCents, 2000); assert.equal(result.creditCents, 3000);
  assert.deepEqual(result.checks.map(check => check.matched), [true, true, true]);
});

test('Missing a whole spending row triggers both withdrawal and balance mismatches', () => {
  const result = reconcileStatement([summary(), { page: 2, period, lines: [] }], csv(rows.slice(1)), [closing()]);
  assert.equal(result.status, 'mismatch');
  assert.deepEqual(result.checks.map(check => check.matched), [false, true, false]);
});

test('Repeated summary totals must agree, while an unreadable summary stays unverified', () => {
  const conflict = summary(2); conflict.lines[1] = line(2, 'Total Withdrawals & Debits', '25.00');
  assert.equal(reconcileStatement([summary(), conflict], csv(rows), [closing()]).status, 'mismatch');
  assert.equal(reconcileStatement([{ page: 2, period, lines: [] }], csv(rows), [closing()]).status, 'unavailable');
  const partial = summary(); partial.lines = partial.lines.slice(1, 2);
  const result = reconcileStatement([partial, { page: 2, period, lines: [] }], csv(rows), [closing()]);
  assert.equal(result.status, 'partial'); assert.equal(result.checks.length, 1);
});

test('Separate check totals are reconciled separately and included in the balance equation', () => {
  const page = summary(2); page.lines.push(line(4, 'Total Checks Paid', '5.00'));
  const result = reconcileStatement([page], csv([...rows, ['09/10/2026', 'Check #123', '5.00', '']]), [closing(10500)]);
  assert.equal(result.status, 'matched'); assert.equal(result.debitCents, 2500);
  assert.equal(result.checks.find(check => check.label === 'Withdrawal total').readCents, 2000);
  assert.equal(result.checks.find(check => check.label === 'Check total').readCents, 500);
});

test('Multi-month PDFs compare each month separately, even when combined totals would hide a misplaced row', () => {
  const august = summary(1, '2026-08-01|2026-08-31');
  const september = summary(2);
  const combined = csv([...rows, ...rows]); combined.locations = [{ page: 1 }, { page: 1 }, { page: 2 }, { page: 2 }];
  const balances = [closing(11000, '2026-08-31'), closing()];
  assert.equal(reconcileStatement([august, september], combined, balances).status, 'matched');
  combined.locations[0].page = 2;
  assert.equal(reconcileStatement([august, september], combined, balances).status, 'mismatch');
});

test('An explicit zero-activity statement passes available checks without requiring transactions', () => {
  const page = summary(); page.lines = [line(1, 'Previous Balance', '.00'), line(2, 'Total Deposits & Credits', '.00')];
  const result = reconcileStatement([page], csv([], 1), [closing(0)]);
  assert.equal(result.status, 'partial'); assert.ok(result.checks.every(check => check.matched));
});

test('Real synthetic sidebar PDF detects a completely omitted purchase row and emits a reading warning', async () => {
  const bytes = await readFile(new URL('./fixtures/citizens-sidebar-synthetic.pdf', import.meta.url));
  const pages = await extractPDFText(bytes.toString('base64'));
  const original = parseCitizensStatement(pages, new Date('2026-10-13T12:00:00'));
  assert.equal(original.reconciliation.status, 'matched');
  const altered = structuredClone(pages);
  const target = original.csv.locations.find((location, index) => Number(original.csv.rows[index][2]) > 0);
  assert.ok(target);
  // Delete every PDF cell on one dated spending line, not just its amount.
  const { pdfLines } = await import('../src/features/bank/citizensStatement.ts');
  const removed = pdfLines(altered[target.page - 1].items).find(line => line.number === target.line);
  assert.ok(removed);
  const y = removed.items[0].y;
  altered[target.page - 1].items = altered[target.page - 1].items.filter(item => Math.abs(item.y - y) > 2);
  const incomplete = parseCitizensStatement(altered, new Date('2026-10-13T12:00:00'));
  assert.equal(incomplete.reconciliation.status, 'mismatch');
  assert.ok(incomplete.warnings.some(warning => /does not match/.test(warning.reason)));
});
