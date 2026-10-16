import { dateFromKey } from '../../lib/calendarDate.ts';
import { transactionDay } from './dates.ts';
import { bankTransactionName } from '../bank/merchantName.ts';
import type { PocketTransaction } from './transactions.ts';
import { canonicalJson } from '../data/recovery.ts';
export const transactionCategories = ['Uncategorized', 'Food', 'Groceries', 'Gas', 'Shopping', 'Subscriptions', 'Housing', 'Transport', 'Health', 'Income', 'Other'] as const;
export type TransactionDetails = { merchant: string; category: string; classification: 'ordinary' | 'transfer' | 'refund' | 'reversal'; note: string };
export type TransactionRevision = { id: string; transactionId: string; originalTransactionId?: string; createdAt: string; before: { details?: TransactionDetails | null; direction?: 'in' | 'out' | null; alias?: { key: string; value: string | null } }; after: TransactionRevision['before']; undoneAt?: string };
export const merchantAliasKey = (row: Pick<PocketTransaction, 'title' | 'source'>) => (['csv', 'citizens-pdf'].includes(row.source) ? bankTransactionName(row.title) : row.title).trim().toLowerCase();
export function annotateRows(rows: PocketTransaction[], details: Record<string, TransactionDetails>, aliases: Record<string, string>) {
  return rows.map(row => ({ ...row, details: details[row.id] ?? details[row.linkedPurchaseId ?? row.purchase?.id ?? ""], displayMerchant: (details[row.id] ?? details[row.linkedPurchaseId ?? row.purchase?.id ?? ""])?.merchant || aliases[merchantAliasKey(row)] }));
}
export function validateDetails(value: TransactionDetails) {
  if (typeof value.merchant !== 'string' || value.merchant.trim().length > 80 || !transactionCategories.includes(value.category as typeof transactionCategories[number]) || !['ordinary', 'transfer', 'refund', 'reversal'].includes(value.classification) || typeof value.note !== 'string' || value.note.length > 500) throw new Error('Check the merchant, category and note.');
  return { ...value, merchant: value.merchant.trim(), note: value.note.trim() };
}
export function revisionCanUndo(revision: TransactionRevision, state: { transactionDetails: Record<string, TransactionDetails>; transactionDirections: Record<string, 'in' | 'out'>; merchantAliases: Record<string, string> }) {
  return !revision.undoneAt && (!('details' in revision.after) || canonicalJson(state.transactionDetails[revision.transactionId] ?? null) === canonicalJson(revision.after.details)) &&
    (!('direction' in revision.after) || (state.transactionDirections[revision.transactionId] ?? null) === revision.after.direction) &&
    (!revision.after.alias || (state.merchantAliases[revision.after.alias.key] ?? null) === revision.after.alias.value);
}
export function filterHistory(rows: PocketTransaction[], options: { from: string; to: string; source: string; category: string; importIds?: string[] }) {
  for (const value of [options.from, options.to]) if (value && !dateFromKey(value)) throw new Error('Use real calendar dates in YYYY-MM-DD format.');
  if (options.from && options.to && options.from > options.to) throw new Error('Start date must come before end date.');
  const ids = options.importIds ? new Set(options.importIds) : null;
  return rows.filter(row => {
    const day = transactionDay(row);
    return (!options.from || day >= options.from) && (!options.to || day <= options.to) && (options.source === 'all' || row.source === options.source) &&
      (options.category === 'all' || (row.details?.category ?? 'Uncategorized') === options.category) && (!ids || ids.has(row.id));
  });
}
