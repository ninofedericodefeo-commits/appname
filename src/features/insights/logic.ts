import { transactionDay } from '../pocket/dates.ts';
import { transactionDisplayName } from '../pocket/transactions.ts';
import type { PocketTransaction } from '../pocket/transactions.ts';
import { dateFromKey } from '../subscriptions/logic.ts';
export function periodRows(rows: PocketTransaction[], from: string, to: string) {
  if (!dateFromKey(from) || !dateFromKey(to) || from > to) throw Error('Choose a valid date range.');
  return rows.filter(row => row.source !== 'savings' && row.status !== 'pending' && transactionDay(row) >= from && transactionDay(row) <= to);
}
export function activityClassification(row: PocketTransaction) {
  if (row.details?.classification) return row.details.classification;
  if (/^(?:transfer|internal transfer|credit card payment|card payment|balance payment)$/i.test(row.transactionType ?? '') || /^(?:online )?transfer (?:from|to)\b/i.test(row.title)) return 'transfer';
  if (/^(?:refund|reversal)$/i.test(row.transactionType ?? '')) return row.transactionType!.toLowerCase();
  return 'ordinary';
}
export function spendingSummary(rows: PocketTransaction[], from: string, to: string) {
  const selected = periodRows(rows, from, to), categories: Record<string, number> = {}, merchants: Record<string, number> = {};
  let spendingCents = 0, incomeCents = 0, refundCents = 0, transferCents = 0, reversalCents = 0;
  for (const row of selected) {
    const classification = activityClassification(row);
    if (classification === 'transfer') { transferCents += row.amountCents; continue; }
    if (classification === 'reversal') { reversalCents += row.amountCents; continue; }
    if (classification === 'refund') { refundCents += row.amountCents; continue; }
    if (row.amountCents > 0) incomeCents += row.amountCents;
    else { const amount = -row.amountCents; spendingCents += amount;
      const category = row.details?.category ?? 'Uncategorized', merchant = transactionDisplayName(row);
      categories[category] = (categories[category] ?? 0) + amount; merchants[merchant] = (merchants[merchant] ?? 0) + amount;
    }
  }
  return { selected, spendingCents, incomeCents, refundCents, transferCents, reversalCents, categories, merchants };
}
const cell = (value: string | number) => { const raw = String(value); return `"${/^\s*[=+\-@]/.test(raw) && !/^[+-]?\d+(?:\.\d+)?$/.test(raw) && typeof value === 'string' ? "'" : ''}${raw.replace(/"/g, '""')}"`; };
export function transactionCsv(rows: PocketTransaction[]) {
  const header = ['Date', 'Merchant', 'Amount USD', 'Category', 'Classification', 'Source', 'Status', 'Original description', 'Record ID'];
  return [header.map(cell).join(','), ...rows.map(row => [transactionDay(row), transactionDisplayName(row), (row.amountCents / 100).toFixed(2), row.details?.category ?? 'Uncategorized', activityClassification(row), row.source, row.status, row.rawDescription ?? row.title, row.id].map(cell).join(','))].join('\r\n');
}
