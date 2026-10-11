import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBankImport, guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';
import { filterTransactions, linkAccountTransactions, mergeAccountTransactions, pocketTransactions, transactionDisplayName } from '../src/features/pocket/transactions.ts';
import { bankTransactionName } from '../src/features/bank/merchantName.ts';
import { availableCents } from '../src/features/pocket/logic.ts';

const now = new Date('2026-10-10T12:00:00');
function read(text, overrides = {}, account = 'Checking') {
  const csv = parseBankCSV(text);
  const mapping = { ...guessMapping(csv), ...overrides };
  return { csv, mapping, ...previewAccountTransactions(csv, mapping, account, now) };
}
const purchase = (overrides = {}) => ({ id: 'manual-1', title: 'Coffee', amountCents: 500, purchasedAt: new Date(2026, 9, 8, 12).toISOString(), source: 'manual', decision: 'pending', ...overrides });

test('Account history retains signed deposits, transfers, fees and pending entries, rejects invalid/non-USD rows', () => {
  const history = read('Date,Description,Debit,Credit,Type,Status,Currency\n10/08/2026,Payroll,,2000,Deposit,Posted,USD\n10/08/2026,Transfer,250,,Transfer,Posted,USD\n10/08/2026,Service fee,3,,Fee,Posted,USD\n10/09/2026,Coffee,5,,Sale,Pending,USD\n10/08/2026,Ambiguous,1,2,Sale,Posted,USD\n10/08/2026,Euro,5,,Sale,Posted,EUR\n10/11/2026,Future,5,,Sale,Posted,USD\n10/08/2026,,5,,Sale,Posted,USD\n10/08/2026,Invalid,bad,,Sale,Posted,USD');
  assert.deepEqual(history.rows.map((item) => item.amountCents), [200000, -25000, -300, -500]);
  assert.deepEqual(history.rows.map((item) => item.status), ['posted', 'posted', 'posted', 'pending']);
  assert.equal(history.excluded.length, 5);
  assert.equal(previewBankCSV(history.csv, history.mapping, 'Checking', [], [], now).rows.length, 0);
});

test('Signed exports respect spending direction and preserve credits and unknown posting status', () => {
  const rows = read('Date,Description,Amount,Type\n10/08/2026,Coffee,5,Sale\n10/08/2026,Payroll,-2000,Deposit\n10/08/2026,Refund,3,Refund', { spendingSign: 'positive' }).rows;
  assert.deepEqual(rows.map((item) => item.amountCents), [-500, 200000, 300]);
  assert.ok(rows.every((item) => item.status === 'recorded'));
  const negative = read('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/08/2026,Payroll,2000');
  assert.deepEqual(negative.rows.map((item) => item.amountCents), [-500, 200000]);
});

test('Repeated same-day movements remain distinct; overlap and account identities deduplicate', () => {
  const text = 'Date,Description,Amount\n10/08/2026,Coffee,-5\n10/08/2026,Coffee,-5';
  const first = read(text).rows;
  assert.notEqual(first[0].id, first[1].id);
  const merged = mergeAccountTransactions([], first, now);
  assert.equal(merged.added, 2);
  const again = mergeAccountTransactions(merged.transactions, read(text).rows, now);
  assert.equal(again.added, 0); assert.equal(again.updated, 0);
  assert.notEqual(read(text, {}, 'Savings').rows[0].id, first[0].id);
  const csv = read(text).csv; csv.source = 'citizens-pdf';
  assert.equal(previewAccountTransactions(csv, guessMapping(csv), 'Checking', now).rows[0].id, first[0].id);
});

test('Bank transaction IDs promote pending to posted once and older imports cannot downgrade status', () => {
  const pending = read('Date,Description,Amount,Status,Transaction ID\n10/08/2026,Coffee,-5,Pending,txn-1').rows;
  const posted = read('Date,Description,Amount,Status,Transaction ID\n10/09/2026,Coffee shop,-6,Posted,txn-1').rows;
  assert.equal(pending[0].id, posted[0].id);
  const unknown = mergeAccountTransactions([], pending.map((item) => ({ ...item, status: 'recorded' })), now).transactions;
  const suppliedStatus = mergeAccountTransactions(unknown, pending, now);
  assert.equal(suppliedStatus.updated, 1); assert.equal(suppliedStatus.transactions[0].status, 'pending');
  assert.equal(mergeAccountTransactions(suppliedStatus.transactions, unknown, now).transactions[0].status, 'pending');
  const initial = mergeAccountTransactions([], pending, now).transactions;
  const result = mergeAccountTransactions(initial, posted, now);
  assert.equal(result.added, 0); assert.equal(result.updated, 1); assert.equal(result.transactions[0].amountCents, -600);
  assert.equal(initial[0].status, 'pending');
  assert.deepEqual(mergeAccountTransactions(result.transactions, pending, now).transactions, result.transactions);
});

test('Account storage validates rows and keeps only transaction metadata', () => {
  const row = read('Date,Description,Amount\n10/08/2026,Coffee,-5').rows[0];
  const valid = mergeAccountTransactions([], [{ ...row, rawStatement: 'discard', linkedPurchaseId: 'manual-1' }], now).transactions;
  assert.equal(valid[0].rawStatement, undefined); assert.equal(valid[0].rowNumber, undefined);
  assert.equal(valid[0].linkedPurchaseId, 'manual-1');
  const bad = [{ ...row, id: 'invalid' }, { ...row, amountCents: 0 }, { ...row, amountCents: 1.5 }, { ...row, status: 'toString' }, { ...row, occurredAt: '2026-10-11T12:00:00' }];
  assert.equal(mergeAccountTransactions([], bad, now).transactions.length, 0);
});

test('Bank and savings records show once, explicit different purchases survive, savings decisions do not become pending bank charges', () => {
  const existing = purchase({ source: 'shortcut' });
  const { csv, mapping, rows } = read('Date,Description,Amount\n10/08/2026,CAFE 123,-5');
  const review = previewBankCSV(csv, mapping, 'Checking', [existing], [], now);
  assert.equal(review.rows[0].matchId, existing.id);
  const matched = linkAccountTransactions(rows, review.rows, new Set());
  assert.equal(pocketTransactions(matched, [existing]).length, 1);
  const separate = linkAccountTransactions(rows, review.rows, new Set([review.rows[0].id]));
  const selectedPurchase = purchase({ ...review.rows[0], source: 'bank-import' });
  assert.equal(pocketTransactions(separate, [existing, selectedPurchase]).length, 2);
  const manual = pocketTransactions([], [existing]);
  assert.equal(manual[0].status, 'logged'); assert.equal(manual[0].amountCents, -500);
  assert.equal(pocketTransactions([], [purchase({ source: 'bank-import', bankSource: 'citizens-pdf' })])[0].status, 'posted');
});

test('Legacy purchase imports link to new bank history without adding charges or changing saved balances', () => {
  const { csv, mapping, rows } = read('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/09/2026,Payroll,2000');
  const review = previewBankCSV(csv, mapping, 'Checking', [], [], now);
  const state = { purchases: [], entries: [], bankImportKeys: [], reportedBalanceCents: 321099, reservedCents: 25000, activeGoal: null };
  const first = applyBankImport(state, review.rows, false, now);
  const repeat = previewBankCSV(csv, mapping, 'Checking', first.state.purchases, first.state.bankImportKeys, now);
  const bank = mergeAccountTransactions([], linkAccountTransactions(rows, repeat.rows, new Set()), now);
  const combined = pocketTransactions(bank.transactions, first.state.purchases);
  assert.equal(combined.length, 2); assert.equal(combined[0].title, 'Payroll');
  assert.equal(first.state.reportedBalanceCents, 321099); assert.equal(first.state.reservedCents, 25000);
  assert.equal(availableCents(first.state.reportedBalanceCents, first.state.reservedCents), 296099);
  assert.equal(availableCents(10000, 25000), -15000);
  assert.equal(availableCents(null, 25000), null);
});

test('Unified history retains purchase controls on linked and standalone rows without rewriting bank data', () => {
  const original = purchase({ decision: 'saved', savedCents: 100 });
  const movement = read('Date,Description,Amount\n10/08/2026,Bank coffee description,-5').rows[0];
  const bank = { ...movement, linkedPurchaseId: original.id };
  const edited = { ...original, title: 'Edited savings purchase', amountCents: 600 };
  const manual = purchase({ id: 'manual-2', title: 'Lunch' });
  const history = pocketTransactions([bank], [edited, manual]);
  assert.equal(history.length, 2);
  const linked = history.find((row) => row.id === bank.id);
  assert.equal(linked.purchase, edited);
  assert.equal(linked.title, 'Bank coffee description');
  assert.equal(linked.amountCents, -500);
  assert.equal(history.find((row) => row.id === manual.id).purchase, manual);
  const afterDelete = pocketTransactions([bank], [manual]);
  assert.equal(afterDelete.find((row) => row.id === bank.id).purchase, undefined);
  assert.equal(afterDelete.length, 2);
});

test('Savings adjustments join chronological history, purchase contributions fold into their purchase, and deleted contributions survive', () => {
  const logged = purchase();
  const entries = [
    { id: 'reserve', amountCents: 25000, createdAt: '2026-10-10T12:00:00Z', kind: 'reserve' },
    { id: 'release', amountCents: 5000, createdAt: '2026-10-09T12:00:00Z', kind: 'release' },
    { id: 'assign', amountCents: 20000, createdAt: '2026-10-07T12:00:00Z', kind: 'assign', goalId: 'goal' },
    { id: 'purchase', amountCents: 100, createdAt: logged.purchasedAt, kind: 'reserve', purchaseId: logged.id },
    { id: 'bad-amount', amountCents: -100, createdAt: logged.purchasedAt, kind: 'reserve' },
    { id: 'bad-date', amountCents: 100, createdAt: 'invalid', kind: 'release' },
  ];
  const history = pocketTransactions([], [logged], entries);
  assert.deepEqual(history.map((row) => row.id), ['savings-reserve', 'savings-release', logged.id, 'savings-assign']);
  assert.equal(history[1].amountCents, -5000);
  assert.ok(history.filter((row) => row.source === 'savings').every((row) => row.status === 'adjustment'));
  assert.ok(pocketTransactions([], [], entries).some((row) => row.id === 'savings-purchase'));
});

test('History filters distinguish bank credits/debits/pending from internal savings and pending savings decisions', () => {
  const bank = read('Date,Description,Amount,Status\n10/08/2026,Coffee,-5,Pending\n10/09/2026,Payroll,2000,Posted').rows;
  const logged = purchase({ id: 'manual-2', decision: 'pending', title: 'Lunch' });
  const history = pocketTransactions(bank, [logged], [
    { id: 'reserve', amountCents: 25000, createdAt: '2026-10-10T12:00:00Z', kind: 'reserve' },
    { id: 'release', amountCents: 5000, createdAt: '2026-10-09T12:00:00Z', kind: 'release' },
  ]);
  assert.deepEqual(filterTransactions(history, '', 'in').map((row) => row.title), ['Payroll']);
  assert.equal(filterTransactions(history, '', 'out').length, 2);
  assert.deepEqual(filterTransactions(history, '', 'pending').map((row) => row.title), ['Coffee']);
  assert.equal(filterTransactions(history, '', 'savings').length, 2);
  assert.equal(filterTransactions(history, ' checking ', 'all').length, 2);
  assert.equal(filterTransactions(history, ' LUNCH ', 'out')[0].purchase, logged);
});

test('Unsorted bank statements, app purchases and adjustments are shown newest first, including across months and time zones', () => {
  const bank = read('Date,Description,Amount\n09/30/2026,Older deposit,200\n10/02/2026,Recent purchase,-5\n08/31/2026,Oldest purchase,-20').rows;
  const purchases = [purchase({ id: 'manual-old', purchasedAt: '2026-09-01T23:00:00-04:00' }),
    purchase({ id: 'shortcut-new', source: 'shortcut', purchasedAt: '2026-10-02T23:00:00-04:00' })];
  const adjustments = [{ id: 'latest', amountCents: 100, createdAt: '2026-10-03T03:01:00Z', kind: 'reserve' }];
  const original = structuredClone({ bank, purchases, adjustments });
  const history = pocketTransactions(bank, purchases, adjustments);
  assert.deepEqual(history.map((row) => row.id), ['savings-latest', 'shortcut-new', bank[1].id, bank[0].id, 'manual-old', bank[2].id]);
  assert.deepEqual(filterTransactions(history, '', 'out').map((row) => row.id), ['shortcut-new', bank[1].id, 'manual-old', bank[2].id]);
  assert.deepEqual({ bank, purchases, adjustments }, original);
});

test('Merchant names hide bank codes without changing originals, identities, real repeated purchases or search', () => {
  for (const [raw, expected] of [
    ['0029 DBT PURCHASE - 9999999 eBay SAN JOSE CA', 'eBay'],
    ['0030 DBT PURCHASE - 8888888 WAWA #0293 PA', 'Wawa'],
    ['DBT PURCHASE DUNKIN 123456 NY', "Dunkin'"],
    ['POS AMZN.COM*ABCDEFG SEATTLE WA', 'Amazon'],
    ['0029 DBT PURCHASE - 9999999 Corner Cafe REF 123456', 'Corner Cafe'],
    ['CARD PURCHASE SQ * Studio 54 09/08/2026', 'Studio 54'],
    ['Post Office', 'Post Office'],
    ['365 Market', '365 Market'],
    ['ATM Exchange Fee', 'ATM Exchange Fee'],
    ['Payroll deposit', 'Payroll deposit'],
    ['Transfer to savings', 'Transfer to savings'],
    ['DBT PURCHASE - 9999999', 'DBT PURCHASE - 9999999'],
  ]) assert.equal(bankTransactionName(raw), expected);
  const raw = '0029 DBT PURCHASE - 9999999 eBay SAN JOSE CA';
  const bank = read(`Date,Description,Amount\n10/08/2026,${raw},-10\n10/08/2026,${raw},-10\n10/09/2026,POS AMZN.COM ABC,-20`).rows;
  const history = pocketTransactions(bank, []);
  assert.equal(history.length, 3); assert.notEqual(bank[0].id, bank[1].id);
  assert.equal(transactionDisplayName(history[1]), 'eBay'); assert.equal(history[1].title, raw);
  assert.equal(filterTransactions(history, 'Amazon', 'out').length, 1);
  assert.equal(filterTransactions(history, '9999999', 'out').length, 2);
  assert.equal(mergeAccountTransactions(bank, read(`Date,Description,Amount\n10/08/2026,${raw},-10\n10/08/2026,${raw},-10`).rows, now).added, 0);
  assert.equal(transactionDisplayName({ source: 'manual', title: 'My eBay refund note' }), 'My eBay refund note');
});
