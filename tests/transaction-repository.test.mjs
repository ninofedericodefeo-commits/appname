import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateRows, filterHistory, getTransactionDetails, validateDetails, revisionCanUndo } from '../src/features/pocket/repository.ts';
import { effectiveBankTransaction, filterTransactions, getTransactionDirection, pocketTransactions, transactionDisplayName } from '../src/features/pocket/transactions.ts';
import { getMerchantAlias, merchantAliasStorageKey, migrateLegacyMerchantAliases, setMerchantAlias } from '../src/features/pocket/merchantAliases.ts';
import { validateJson } from '../src/features/data/backupFormat.ts';
const rows = [{ id: 'one', title: '0029 DBT PURCHASE - 9999999 eBay', source: 'citizens-pdf', amountCents: -999, occurredAt: '2026-10-01T12:00:00Z', accountLabel: 'Checking', status: 'posted' }, { id: 'two', title: '0029 DBT PURCHASE - 9999999 eBay', source: 'citizens-pdf', amountCents: -999, occurredAt: '2026-09-01T12:00:00Z', accountLabel: 'Checking', status: 'posted' }];
const detail = { merchant: 'eBay purchase', category: 'Shopping', classification: 'ordinary', note: 'Book' };
test('Annotations/aliases never rewrite evidence or collapse equal purchases; search includes categories and notes', () => {
  const before = structuredClone(rows), projected = annotateRows(rows, { one: detail }, { ebay: 'eBay' });
  assert.deepEqual(rows, before); assert.equal(projected.length, 2); assert.equal(projected[0].id, 'one');
  assert.equal(transactionDisplayName(projected[0]), 'eBay purchase'); assert.equal(filterTransactions(projected, 'Book', 'all').length, 1);
  assert.equal(filterHistory(projected, { from: '2026-10-01', to: '2026-10-31', category: 'Shopping', source: 'citizens-pdf' }).length, 1);
  assert.equal(filterHistory(projected, { from: '', to: '', category: 'all', source: 'all', importIds: ['two'] })[0].id, 'two');
  assert.throws(() => filterHistory(projected, { from: 'bad', to: '', category: 'all', source: 'all' }));
  assert.throws(() => validateDetails({ ...detail, category: 'arbitrary' }));
});
test('Undo refuses to overwrite a later edit and distinguishes undone revisions', () => {
  const revision = { id: 'edit', transactionId: 'one', before: { details: null }, after: { details: detail } };
  const state = { transactionDetails: { one: detail }, transactionDirections: {}, merchantAliases: {} };
  assert.equal(revisionCanUndo(revision, state), true);
  assert.equal(revisionCanUndo({ ...revision, undoneAt: '2026-10-14' }, state), false);
  assert.equal(revisionCanUndo(revision, { ...state, transactionDetails: { one: { ...detail, note: 'later' } } }), false);
  assert.equal(revisionCanUndo({ ...revision, after: { direction: 'in' } }, state), false);
});

test('Prototype property merchant names render from transaction text unless an explicit alias is saved', () => {
  const names = ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty'];
  for (const title of names) {
    const row = { ...rows[0], title, source: 'shortcut' };
    const plain = annotateRows([row], {}, {})[0];
    assert.equal(transactionDisplayName(plain), title);
    assert.doesNotThrow(() => transactionDisplayName(plain).replace(/x/g, ''));
    const aliasKey = title.toLowerCase();
    const aliases = setMerchantAlias({}, aliasKey, `Alias for ${title}`);
    const reloaded = JSON.parse(JSON.stringify(aliases));
    assert.doesNotThrow(() => validateJson({ merchantAliases: reloaded }));
    assert.equal(transactionDisplayName(annotateRows([row], {}, reloaded)[0]), `Alias for ${title}`);
    assert.equal(transactionDisplayName(annotateRows([row], {}, setMerchantAlias(reloaded, aliasKey, null))[0]), title);
  }
});

test('Aliases use only own string values and display names always fall back to transaction text', () => {
  const row = { ...rows[0], title: 'Coffee', source: 'manual' };
  const inherited = Object.create({ coffee: 'Unexpected inherited alias' });
  assert.equal(getMerchantAlias(inherited, 'coffee'), undefined);
  assert.equal(transactionDisplayName(annotateRows([row], {}, inherited)[0]), 'Coffee');
  for (const invalid of [Object.prototype, {}, [], 42, true, null]) {
    assert.equal(getMerchantAlias({ coffee: invalid }, 'coffee'), undefined);
    assert.equal(transactionDisplayName(annotateRows([row], {}, { coffee: invalid })[0]), 'Coffee');
    assert.equal(transactionDisplayName({ ...row, displayMerchant: invalid }), 'Coffee');
  }
  assert.equal(transactionDisplayName({ ...row, title: {}, displayMerchant: {} }), '');
});

test('Reserved alias keys and literal escape-prefix merchants remain distinct through persistence and migration', () => {
  const names = ['ebay', '__proto__', 'constructor', 'prototype', '~gasfinder-alias:__proto__', '~gasfinder-alias:~gasfinder-alias:__proto__'];
  assert.equal(merchantAliasStorageKey('ebay'), 'ebay');
  assert.equal(new Set(names.map(merchantAliasStorageKey)).size, names.length);
  const legacy = Object.fromEntries(names.map((name, index) => [name, `Alias ${index}`]));
  const aliases = migrateLegacyMerchantAliases(JSON.parse(JSON.stringify(legacy)));
  assert.doesNotThrow(() => validateJson({ merchantAliases: aliases }));
  const reloaded = JSON.parse(JSON.stringify(aliases));
  names.forEach((name, index) => assert.equal(getMerchantAlias(reloaded, name), `Alias ${index}`));
  // A new encoded reserved name is never also read as a legacy literal prefix.
  assert.equal(getMerchantAlias(setMerchantAlias({}, '__proto__', 'Reserved'), '~gasfinder-alias:__proto__'), undefined);
  assert.deepEqual(migrateLegacyMerchantAliases(Object.create({ coffee: 'Inherited' })), {});
  assert.deepEqual(migrateLegacyMerchantAliases({ coffee: {}, ebay: 'eBay' }), { ebay: 'eBay' });
});

test('Linked details fall back past inherited or malformed primary dictionary entries', () => {
  const linked = { ...rows[0], id: '__proto__', linkedPurchaseId: 'purchase', title: 'Coffee', source: 'manual' };
  const details = { purchase: detail };
  assert.equal(getTransactionDetails(details, '__proto__'), undefined);
  assert.equal(annotateRows([linked], details, {})[0].details, detail);
  assert.equal(annotateRows([linked], details, {})[0].displayMerchant, detail.merchant);
  const primary = Object.fromEntries([['__proto__', { ...detail, merchant: {} }], ['purchase', detail]]);
  assert.equal(annotateRows([linked], primary, {})[0].details, detail);
  const inherited = Object.create({ one: detail });
  assert.equal(annotateRows([rows[0]], inherited, {})[0].details, undefined);
  assert.equal(annotateRows([rows[0]], { one: detail }, {})[0].details, detail);
});

test('Undo uses encoded aliases and own typed current details and directions', () => {
  const key = '__proto__';
  const revision = { id: 'edit', transactionId: key, before: { alias: { key, value: null } }, after: { alias: { key, value: 'Alias' } } };
  const state = { transactionDetails: {}, transactionDirections: {}, merchantAliases: setMerchantAlias({}, key, 'Alias') };
  assert.equal(revisionCanUndo(revision, state), true);
  assert.equal(revisionCanUndo(revision, { ...state, merchantAliases: setMerchantAlias(state.merchantAliases, key, 'Later') }), false);
  const undone = setMerchantAlias(state.merchantAliases, revision.before.alias.key, revision.before.alias.value);
  assert.equal(getMerchantAlias(undone, key), undefined);
  assert.doesNotThrow(() => validateJson({ merchantAliases: undone, correctionHistory: [revision] }));
  const absent = { ...revision, after: { details: null, direction: null, alias: { key, value: null } } };
  assert.equal(revisionCanUndo(absent, { ...state, merchantAliases: {} }), true);
  assert.equal(revisionCanUndo({ ...revision, after: { direction: 'in' } }, { ...state, transactionDirections: Object.create({ [key]: 'in' }) }), false);
  assert.equal(revisionCanUndo({ ...revision, after: { direction: 'in' } }, { ...state, transactionDirections: Object.fromEntries([[key, 'in']]) }), true);
});

test('Bank direction lookups ignore inherited and malformed primary values and keep linked corrections', () => {
  const bank = { ...rows[0], linkedPurchaseId: 'purchase' };
  const inherited = Object.create({ [bank.id]: 'in' });
  assert.equal(getTransactionDirection(inherited, bank.id), undefined);
  assert.equal(effectiveBankTransaction(bank, inherited).amountCents, bank.amountCents);
  assert.equal(pocketTransactions([bank], [], [], [], inherited)[0].amountCents, bank.amountCents);
  for (const invalid of [Object.prototype, {}, [], 42, 'other']) {
    const directions = { [bank.id]: invalid, purchase: 'in' };
    assert.equal(getTransactionDirection(directions, bank.id), undefined);
    assert.equal(effectiveBankTransaction(bank, directions).amountCents, -bank.amountCents);
    assert.equal(pocketTransactions([bank], [], [], [], directions)[0].amountCents, -bank.amountCents);
  }
});
