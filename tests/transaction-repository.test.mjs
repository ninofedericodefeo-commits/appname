import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateRows, filterHistory, validateDetails, revisionCanUndo } from '../src/features/pocket/repository.ts';
import { filterTransactions, transactionDisplayName } from '../src/features/pocket/transactions.ts';
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
