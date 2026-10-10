import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractPDFText } from '../src/features/bank/extractPDFText.ts';
import { parseCitizensStatement } from '../src/features/bank/citizensStatement.ts';
import { applyBankImport, guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';
import { linkAccountTransactions, mergeAccountTransactions, pocketTransactions } from '../src/features/pocket/transactions.ts';
import { suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';

const now = new Date('2026-10-10T12:00:00');
const item = (text, x, y) => ({ text, x, y, width: text.length * 5, height: 10 });
const line = (y, ...cells) => cells.map(([text, x]) => item(text, x, y));
const page = (rows, { number = 1, period = '09/01/2026 - 09/30/2026', bank = 'Citizens Bank', section = 'Withdrawals & Debits', headers = [['Date', 40], ['Description', 110], ['Amount', 400]], extra = [] } = {}) => ({ page: number, items: [
  ...line(20, [bank, 40]), ...line(40, [`Statement period ${period}`, 40]), ...extra,
  ...line(80, [section, 40]), ...line(100, ...headers), ...rows.flatMap((cells, index) => line(120 + index * 20, ...cells)),
] });
const state = () => ({ activeGoal: null, reservedCents: 0, reportedBalanceCents: 250000, purchases: [], entries: [], bankImportKeys: [] });
const review = (statement, history = [], keys = []) => previewBankCSV(statement.csv, guessMapping(statement.csv), 'Main checking', history, keys, now);

test('The bundled PDF engine extracts a real synthetic PDF, imports only purchases and feeds subscription suggestions', async () => {
  const bytes = await readFile(new URL('./fixtures/citizens-synthetic.pdf', import.meta.url));
  // The engine must never fetch a worker, font or original statement over the network.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected network request during local PDF extraction'); };
  let pages;
  try { pages = await extractPDFText(bytes.toString('base64')); } finally { globalThis.fetch = originalFetch; }
  const parsed = parseCitizensStatement(pages, now);
  assert.equal(parsed.pages, 3); assert.equal(parsed.periods.length, 3); assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.csv.rows.length, 21);
  const rows = review(parsed);
  assert.equal(rows.rows.length, 9); assert.equal(rows.excluded.length, 12);
  assert.equal(rows.rows[2].title, 'Corner Cafe Downtown location');
  assert.equal(rows.rows[3].pageNumber, 2); assert.equal(rows.rows[3].amountCents, 1699);
  const result = applyBankImport(state(), rows.rows, false, now);
  assert.equal(result.imported, 9); assert.equal(result.savedCents, 0); assert.equal(result.state.reservedCents, 0);
  assert.equal(result.state.purchases[0].bankSource, 'citizens-pdf');
  const movements = previewAccountTransactions(parsed.csv, guessMapping(parsed.csv), 'Main checking', now);
  assert.equal(movements.rows.length, 21); assert.equal(movements.excluded.length, 0);
  assert.equal(movements.rows.filter((row) => row.amountCents === 200000).length, 3);
  assert.equal(movements.rows.filter((row) => row.amountCents === -300).length, 3);
  const ledger = mergeAccountTransactions([], linkAccountTransactions(movements.rows, rows.rows, new Set(rows.rows.map((row) => row.id))), now);
  assert.equal(pocketTransactions(ledger.transactions, result.state.purchases).length, 21);
  assert.equal(result.state.reportedBalanceCents, 250000);
  assert.ok(review(parsed, result.state.purchases, result.state.bankImportKeys).rows.every((row) => row.duplicate === 'known'));
  const netflix = suggestBankSubscriptions(result.state.purchases, [], [], now).find((suggestion) => suggestion.name === 'Netflix');
  assert.equal(netflix.cadence, 'monthly'); assert.equal(netflix.evidence.length, 3); assert.equal(netflix.amountCents, 1699);
  const csv = parseBankCSV('Date,Description,Amount\n09/05/2026,Recurring POS NETFLIX,-16.99');
  assert.equal(previewBankCSV(csv, guessMapping(csv), 'Main checking', result.state.purchases, result.state.bankImportKeys, now).rows[0].duplicate, 'known');
});

test('Positioned amount columns exclude running balances and preserve decimal text in merchant descriptions', () => {
  const parsed = parseCitizensStatement([page([[['09/08', 40], ['Subscription plan 9.99', 110], ['19.99', 400], ['1,000.00', 500]]], { headers: [['Date', 40], ['Description', 110], ['Amount', 400], ['Balance', 500]] })], now);
  assert.equal(parsed.csv.rows[0][1], 'Subscription plan 9.99'); assert.equal(review(parsed).rows[0].amountCents, 1999);
  const rightAligned = parseCitizensStatement([page([[['09/08', 40], ['Shop', 110], ['1,234.56', 390]]])], now);
  assert.equal(review(rightAligned).rows[0].amountCents, 123456);
  const ambiguous = page([[['09/08', 40], ['Merchant 19.99 1,000.00', 110]]], { headers: [['Date Description Amount', 40]] });
  assert.throws(() => parseCitizensStatement([ambiguous], now), /No supported/);
});

test('Statement dates infer years only within a verified period including year rollover', () => {
  const parsed = parseCitizensStatement([page([[['12/22', 40], ['Netflix', 110], ['16.99', 400]], [['01/05', 40], ['Spotify', 110], ['11.99', 400]]], { period: '12/15/2025 - 01/14/2026' })], now);
  assert.deepEqual(parsed.csv.rows.map((row) => row[0]), ['12/22/2025', '01/05/2026']);
  const named = parseCitizensStatement([page([[['09/08/26', 40], ['Spotify', 110], ['11.99', 400]]], { period: 'September 1, 2026 through September 30, 2026' })], now);
  assert.equal(named.csv.rows[0][0], '09/08/2026');
  assert.throws(() => parseCitizensStatement([page([[['09/08', 40], ['Spotify', 110], ['11.99', 400]]], { period: 'not readable' })], now), /date range/);
});

test('Continuation pages preserve wrapped descriptions without appending page headers or balances', () => {
  const first = page([[['09/08', 40], ['Recurring POS', 110], ['11.99', 400]]]);
  const second = page([[['SPOTIFY', 110]], [['09/09', 40], ['Shop', 110], ['5.50', 400]], [['Total withdrawals 17.49', 40]]], { number: 2, section: 'Withdrawals & Debits (continued)' });
  second.items.push(...line(50, ['PRIVATE HEADER MUST NOT BECOME A MERCHANT', 40]));
  const parsed = parseCitizensStatement([first, second], now);
  assert.equal(parsed.csv.rows[0][1], 'Recurring POS SPOTIFY'); assert.equal(parsed.csv.locations[0].page, 1);
});

test('Unreadable/negative/credit-marked/out-of-range rows produce visible warnings while valid purchases remain', () => {
  const parsed = parseCitizensStatement([page([
    [['09/08', 40], ['Valid shop', 110], ['5.50', 400]],
    [['09/09', 40], ['Refund', 110], ['5.00-', 400]],
    [['09/10', 40], ['Refund', 110], ['5.00', 400], ['CR', 435]],
    [['10/01', 40], ['Outside period', 110], ['6.00', 400]],
    [['09/11', 40], ['No amount', 110]],
    [['09/12', 40], ['Negative', 110], ['(4.00)', 400]],
  ])], now);
  assert.equal(review(parsed).rows.length, 1); assert.equal(parsed.warnings.length, 5);
});

test('Deposits, transfers, fees, checks, summary balances and card payments do not become purchases', () => {
  const pages = [page([[['09/08', 40], ['Payroll', 110], ['2,000.00', 400]]], { section: 'Deposits and other credits' }),
    page([[['09/08', 40], ['Zelle transfer', 110], ['50.00', 400]], [['09/09', 40], ['Service fee', 110], ['3.00', 400]], [['09/10', 40], ['Shop', 110], ['5.00', 400]]], { number: 2, section: 'Other withdrawals and debits' }),
    page([[['09/09', 40], ['1234', 110], ['200.00', 400]]], { number: 3, section: 'Checks paid' })];
  const parsed = review(parseCitizensStatement(pages, now));
  assert.deepEqual(parsed.rows.map((row) => row.title), ['Shop']); assert.equal(parsed.excluded.length, 3);
});

test('Reject unsupported bank/card/multi-account/currency/scanned PDFs and oversized inputs', async () => {
  const rows = [[['09/08', 40], ['Shop', 110], ['5.50', 400]]];
  assert.throws(() => parseCitizensStatement([page(rows, { bank: 'First Citizens Bank' })], now), /Other banks/);
  assert.throws(() => parseCitizensStatement([page(rows, { extra: line(60, ['Credit card statement minimum payment', 40]) })], now), /credit card/);
  assert.throws(() => parseCitizensStatement([page(rows, { extra: line(60, ['Currency: CAD', 40]) })], now), /USD/);
  assert.throws(() => parseCitizensStatement([page(rows, { extra: line(60, ['Account number 00001', 40]) }), page(rows, { number: 2, extra: line(60, ['Account number 00002', 40]) })], now), /multiple accounts/);
  assert.throws(() => parseCitizensStatement([{ page: 1, items: [] }], now), /no readable text/);
  assert.throws(() => parseCitizensStatement(Array(41).fill(page(rows)), now), /1–40/);
  await assert.rejects(extractPDFText(Buffer.from('not a pdf').toString('base64')), /valid PDF/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(extractPDFText('', abort.signal), /canceled/);
});

test('Page 2 card spending is read under withdrawal headings with counts/totals and page 3 credits remain intact', () => {
  const first = page([], { extra: line(60, ['Ending balance $2,456.42', 40]), section: 'Account summary' });
  const second = page([[['09-08', 40], ['POS Wawa', 110], ['4.47', 400]], [['09-08', 40], ['POS Wawa', 110], ['4.47', 400]], [['09-09', 40], ["Dunkin'", 110], ['6.08', 400]]], { number: 2, section: 'ATM and Debit Card Withdrawals (3)', headers: [['Date', 40], ['Transaction Description', 110], ['Amount ($)', 400]] });
  const third = page([[['09/10', 40], ['Payroll', 110], ['100.00', 400]]], { number: 3, section: 'Deposits and Credits $100.00' });
  const parsed = parseCitizensStatement([first, second, third], now);
  assert.deepEqual(parsed.pageCounts, [{ page: 1, spending: 0, credits: 0 }, { page: 2, spending: 3, credits: 0 }, { page: 3, spending: 0, credits: 1 }]);
  assert.equal(parsed.balance.amountCents, 245642); assert.equal(parsed.balance.asOf, '2026-09-30');
  assert.equal(review(parsed).rows.length, 3);
  assert.equal(previewAccountTransactions(parsed.csv, guessMapping(parsed.csv), 'Main checking', now).rows.length, 4);
});

test('Explicit debit/credit columns identify direction without a recognized section, and ambiguous directions warn', () => {
  const parsed = parseCitizensStatement([page([
    [['09/08', 40], ['Shop', 110], ['10.00', 350], ['0.00', 450]], [['09/09', 40], ['Payroll', 110], ['0.00', 350], ['100.00', 450]],
    [['09/10', 40], ['Ambiguous', 110], ['10.00', 350], ['20.00', 450]],
  ], { section: 'Transaction details', headers: [['Date', 40], ['Description', 110], ['Withdrawals', 350], ['Deposits', 450]] })], now);
  assert.equal(parsed.csv.rows[0][2], '10.00'); assert.equal(parsed.csv.rows[1][3], '100.00');
  assert.equal(parsed.csv.rows[0][1], 'Shop'); assert.equal(parsed.csv.rows[1][1], 'Payroll');
  assert.equal(parsed.warnings.length, 1);
});

test('Balance extraction ignores beginning/running/average balances and refuses conflicting closing balances', () => {
  const rows = [[['09/08', 40], ['Shop', 110], ['5.50', 400]]];
  const first = page(rows, { period: '09/01/26 - 09/30/26', extra: [...line(45, ['Beginning balance $9,000.00', 40]), ...line(60, ['Closing balance $1,234.56', 40])] });
  const parsed = parseCitizensStatement([first], now);
  assert.equal(parsed.balance.amountCents, 123456);
  const second = page(rows, { number: 2, extra: line(60, ['Ending balance $1,111.11', 40]) });
  assert.equal(parseCitizensStatement([first, second], now).balance, null);
  const absent = page(rows, { extra: line(60, ['Average daily balance $8,000.00', 40]) });
  assert.equal(parseCitizensStatement([absent], now).balance, null);
  const split = page(rows, { extra: [...line(55, ['Ending balance', 40]), ...line(68, ['$1,234.56', 400])] });
  assert.equal(parseCitizensStatement([split], now).balance.amountCents, 123456);
});

test('Unknown spending on a later page warns instead of silently carrying an account-summary skip section', () => {
  const first = page([], { section: 'Account summary' });
  const second = page([[['09/08', 40], ['Shop', 110], ['5.50', 400]]], { number: 2, section: 'Unrecognized transactions' });
  const third = page([[['09/09', 40], ['Payroll', 110], ['100.00', 400]]], { number: 3, section: 'Deposits' });
  const parsed = parseCitizensStatement([first, second, third], now);
  assert.equal(parsed.warnings[0].page, 2); assert.equal(parsed.pageCounts[1].spending, 0);
});
