import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBankImport, guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '../src/features/bank/importLogic.ts';
import { filterTransactions, hideTransactionFromHistory, linkAccountTransactions, mergeAccountTransactions, pocketTransactions, transactionDisplayName } from '../src/features/pocket/transactions.ts';
import { applyAccountImport } from '../src/features/bank/accountImport.ts';
import { suggestBankSubscriptions } from '../src/features/subscriptions/bankSuggestions.ts';
import { bankTransactionName } from '../src/features/bank/merchantName.ts';
import { availableCents } from '../src/features/pocket/logic.ts';

const now = new Date('2026-10-10T12:00:00');
function read(text, overrides = {}, account = 'Checking') {
  const csv = parseBankCSV(text);
  const mapping = { ...guessMapping(csv), ...overrides };
  return { csv, mapping, ...previewAccountTransactions(csv, mapping, account, now) };
}
const purchase = (overrides = {}) => ({ id: 'manual-1', title: 'Coffee', amountCents: 500, purchasedAt: new Date(2026, 9, 8, 12).toISOString(), source: 'manual', decision: 'pending', ...overrides });

test('Remove each history source, persist removal, and undo without changing the financial records', () => {
  const bank = read('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/09/2026,Payroll,2000').rows;
  const purchases = [purchase(), purchase({ id: 'shortcut-1', source: 'shortcut' })];
  const entries = [{ id: 'reserve', amountCents: 5000, createdAt: '2026-10-10T12:00:00Z', kind: 'reserve' }];
  const original = structuredClone({ bank, purchases, entries });
  const rows = pocketTransactions(bank, purchases, entries);
  for (const row of rows) {
    const result = hideTransactionFromHistory(rows, [], row.id);
    const persisted = JSON.parse(JSON.stringify(result.hiddenIds));
    assert.equal(pocketTransactions(bank, purchases, entries, persisted).length, rows.length - 1);
    assert.ok(!pocketTransactions(bank, purchases, entries, persisted).some(item => item.id === row.id));
    const restored = persisted.filter(id => !result.removedIds.includes(id));
    assert.deepEqual(pocketTransactions(bank, purchases, entries, restored), rows);
  }
  assert.deepEqual({ bank, purchases, entries }, original);
  assert.deepEqual(hideTransactionFromHistory(rows, [], 'unknown'), { hiddenIds: [], removedIds: [] });
});

test('Removing a linked purchase hides both identities, keeps real equal purchases, and survives reimport', () => {
  const csv = parseBankCSV('Date,Description,Amount\n10/08/2026,Coffee,-5\n10/08/2026,Coffee,-5');
  const logged = purchase();
  const initial = { purchases: [logged], accountTransactions: [], bankImportKeys: [], entries: [], activeGoal: null, reportedBalanceCents: 100000, reservedCents: 5000 };
  const mapping = guessMapping(csv);
  const preview = previewBankCSV(csv, mapping, 'Checking', initial.purchases, [], now);
  const selected = preview.rows.filter(row => !row.duplicate);
  const history = linkAccountTransactions(previewAccountTransactions(csv, mapping, 'Checking', now).rows, preview.rows, new Set(selected.map(row => row.id)));
  const first = applyAccountImport(initial, selected, false, 'Checking', history, { matches: preview.rows.filter(row => row.duplicate === 'possible') }, now).state;
  const rows = pocketTransactions(first.accountTransactions, first.purchases);
  const linked = rows.find(row => row.linkedPurchaseId === logged.id);
  const removed = hideTransactionFromHistory(rows, [], linked.id);
  assert.deepEqual(new Set(removed.hiddenIds), new Set([linked.id, logged.id]));
  const state = { ...first, hiddenTransactionIds: removed.hiddenIds };
  const repeated = applyAccountImport(state, [], false, 'Checking', history, {}, now);
  assert.equal(repeated.transactionsAdded, 0); assert.equal(repeated.imported, 0);
  assert.deepEqual(repeated.state.hiddenTransactionIds, removed.hiddenIds);
  const visible = pocketTransactions(repeated.state.accountTransactions, repeated.state.purchases, [], repeated.state.hiddenTransactionIds);
  assert.equal(visible.length, 1); assert.notEqual(visible[0].id, linked.id);
  assert.equal(repeated.state.reportedBalanceCents, initial.reportedBalanceCents);
  assert.equal(repeated.state.reservedCents, initial.reservedCents);
  assert.deepEqual(pocketTransactions([], first.purchases, [], removed.hiddenIds).map(row => row.id), [visible[0].purchase.id]);
});

test('A removed manual purchase stays removed after bank linking and its savings contribution cannot resurface', () => {
  const logged = purchase();
  const contribution = { id: 'contribution', amountCents: 100, createdAt: logged.purchasedAt, purchaseId: logged.id, kind: 'reserve' };
  const removed = hideTransactionFromHistory(pocketTransactions([], [logged], [contribution]), [], logged.id);
  const bank = read('Date,Description,Amount\n10/08/2026,Coffee,-5').rows.map(row => ({ ...row, linkedPurchaseId: logged.id }));
  assert.deepEqual(pocketTransactions(bank, [logged], [contribution], removed.hiddenIds), []);
  assert.deepEqual(pocketTransactions(bank, [], [contribution], removed.hiddenIds), []);
  // Undo only the IDs introduced by this removal, preserving earlier removals.
  const prehidden = [bank[0].id];
  const next = hideTransactionFromHistory(pocketTransactions(bank, [logged]), prehidden, bank[0].id);
  assert.deepEqual(next.removedIds, [logged.id]);
  assert.deepEqual(next.hiddenIds.filter(id => !next.removedIds.includes(id)), prehidden);
});

test('History removal preserves subscription evidence and already confirmed savings', () => {
  const purchases = [purchase({ title: 'Netflix', source: 'bank-import', bankSource: 'citizens-pdf', bankAccountLabel: 'Checking', decision: 'saved', savedCents: 100, amountCents: 1599 })];
  const before = suggestBankSubscriptions(purchases, [], [], now);
  assert.equal(before.length, 1);
  const removed = hideTransactionFromHistory(pocketTransactions([], purchases), [], purchases[0].id);
  assert.deepEqual(pocketTransactions([], purchases, [], removed.hiddenIds), []);
  assert.deepEqual(suggestBankSubscriptions(purchases, [], [], now), before);
  assert.equal(purchases[0].savedCents, 100);
});

test('A removed Citizens row stays removed when reimport repairs its earlier parser identity', () => {
  const csv = parseBankCSV('Date,Description,Debit,Credit\n10/08/2026,VENMO CASHOUT SAMPLE,,10');
  csv.source = 'citizens-pdf';
  const corrected = previewAccountTransactions(csv, guessMapping(csv), 'Checking', now).rows;
  const old = { ...corrected[0], id: 'account-aaaaaaaaaaaaaaaa', amountCents: -1000 };
  const state = { purchases: [], entries: [], activeGoal: null, bankImportKeys: [], reportedBalanceCents: 100000, reservedCents: 5000,
    accountTransactions: [old], hiddenTransactionIds: [old.id] };
  const result = applyAccountImport(state, [], false, 'Checking', corrected, {}, now);
  assert.equal(result.transactionsAdded, 0); assert.equal(result.transactionsUpdated, 1);
  assert.deepEqual(pocketTransactions(result.state.accountTransactions, [], [], result.state.hiddenTransactionIds), []);
  assert.deepEqual(state.hiddenTransactionIds, [old.id]);
});

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

test('Reimport repairs unique Citizens deposit-direction errors and confirmed purchase identities without double history rows', () => {
  const csv = parseBankCSV('Date,Description,Debit,Credit\n10/08/2026,ONLINE TRANSFER FROM CHECKING SAMPLE,,100\n10/08/2026,VENMO CASHOUT SAMPLE,,10\n10/08/2026,Coffee,5,\n10/08/2026,VENMO PAYMENT SAMPLE,20,');
  csv.source = 'citizens-pdf';
  const corrected = previewAccountTransactions(csv, guessMapping(csv), 'Checking', now).rows.map(row => row.title === 'Coffee' ? { ...row, linkedPurchaseId: 'manual-1' } : row);
  const old = corrected.map((row,index) => ({ ...row, id: `account-${String(index+1).padStart(16,'a')}`, amountCents: -Math.abs(row.amountCents), ...(row.title === 'Coffee' ? { title: 'Coffee with accidental sidebar total' } : row.title === 'VENMO PAYMENT SAMPLE' ? { title: 'VENMO PAYMENT SAMPLE Deposits & Credits Total Deposits & Credits' } : {}) }));
  const before = structuredClone(old);
  const result = mergeAccountTransactions(old, corrected, now);
  assert.equal(result.added,0); assert.equal(result.updated,4); assert.equal(result.transactions.length,4);
  assert.deepEqual(result.transactions.map(row=>row.amountCents),[10000,1000,-500,-2000]);
  assert.deepEqual(old,before);
  const repeated = mergeAccountTransactions(result.transactions,corrected,now);
  assert.equal(repeated.added,0); assert.equal(repeated.updated,0); assert.equal(repeated.transactions.length,4);
  // Preserve both movements when the PDF really contains the debit and credit.
  const legitimate = mergeAccountTransactions([old[0]],[old[0],corrected[0]],now);
  assert.equal(legitimate.transactions.length,2);
  const ambiguous = mergeAccountTransactions([old[0],{...old[0],id:'account-bbbbbbbbbbbbbbbb'}],[corrected[0]],now);
  assert.equal(ambiguous.transactions.length,3);
  const anotherAccount = mergeAccountTransactions([{...old[0],accountLabel:'Savings'}],[corrected[0]],now);
  assert.equal(anotherAccount.transactions.length,2);
  const anotherBank = mergeAccountTransactions([{...old[0],source:'csv'}],[corrected[0]],now);
  assert.equal(anotherBank.transactions.length,2);
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
