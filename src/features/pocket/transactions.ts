import { transactionDay } from './dates.ts';
import type { TransactionDetails } from './repository.ts';
import type { LoggedPurchase } from '../goals/logic.ts';
import { bankTransactionName } from '../bank/merchantName.ts';

export type AccountTransaction = {
  id: string;
  title: string;
  // Signed account movement: credits positive, debits negative.
  amountCents: number;
  occurredAt: string;
  sourceDate?: string;
  duplicateOf?: string;
  sourcePage?: number;
  sourceLine?: number;
  sourceRow?: number;
  rawDescription?: string;
  shadowPurchaseIds?: string[];
  source: 'csv' | 'citizens-pdf' | 'manual';
  status: 'posted' | 'pending' | 'recorded';
  accountLabel: string;
  accountId?: string;
  recurringHint?: boolean;
  transactionType?: string;
  linkedPurchaseId?: string;
};

export type PocketTransaction = Omit<AccountTransaction, 'source' | 'status'> & {
  directionCorrected?: boolean;
  details?: TransactionDetails;
  displayMerchant?: string;
  source: AccountTransaction['source'] | 'manual' | 'shortcut' | 'savings';
  status: AccountTransaction['status'] | 'logged' | 'adjustment';
  purchase?: LoggedPurchase;
  adjustmentKind?: SavingsAdjustment['kind'];
};

export function mergeAccountTransactions(existing: AccountTransaction[], incoming: AccountTransaction[], now = new Date(), directions: TransactionDirections = {}) {
  const transactions = new Map(existing.map((item) => [item.id, item]));
  const latest = new Date(now); latest.setHours(23, 59, 59, 999);
  const rank = { recorded: 0, pending: 1, posted: 2 };
  const incomingIds = new Set(incoming.map((item) => item.id));
  const legacyByDate = new Map<string, AccountTransaction[]>();
  const dateKey = (item: AccountTransaction) => JSON.stringify([item.accountId ?? item.accountLabel.trim().toLowerCase(), item.occurredAt]);
  for (const item of existing) {
    if (item.source !== 'citizens-pdf') continue;
    const key = dateKey(item);
    const rows = legacyByDate.get(key) ?? [];
    rows.push(item); legacyByDate.set(key, rows);
  }
  let added = 0, updated = 0;
  const replacedIds: { from: string; to: string }[] = [];
  for (const item of incoming) {
    if (!/^account-[a-f0-9]{16}$/.test(item.id) || !item.title.trim() || item.title.length > 80 ||
      !Number.isSafeInteger(item.amountCents) || item.amountCents === 0 || Math.abs(item.amountCents) > 100_000_000 ||
      !Number.isFinite(Date.parse(item.occurredAt)) || Date.parse(item.occurredAt) > latest.getTime() ||
      !['csv', 'citizens-pdf', 'manual'].includes(item.source) || !['pending', 'recorded', 'posted'].includes(item.status) || !item.accountLabel.trim() || item.accountLabel.length > 60) continue;
    let old = transactions.get(item.id);
    if (!old && item.source === 'citizens-pdf') {
      // Earlier Citizens parsing could append sidebar totals to a purchase,
      // changing its identity, or label transfer-from/cashout deposits as debits.
      // Repair only a unique orphan from that parser: a confirmed purchase link,
      // an exact incoming-transfer description/date/amount, or a recognizable
      // section/total suffix appended to a transfer. A debit actually
      // present in this PDF stays distinct, as do ambiguous equal purchases.
      const depositCorrection = item.amountCents > 0 && /^(?:online transfer from checking\b|venmo cashout\b)/i.test(item.title);
      const matches = (legacyByDate.get(dateKey(item)) ?? []).filter((candidate) => transactions.has(candidate.id) && !incomingIds.has(candidate.id) &&
        (item.linkedPurchaseId && candidate.linkedPurchaseId === item.linkedPurchaseId && candidate.amountCents === item.amountCents ||
          depositCorrection && !candidate.linkedPurchaseId && candidate.amountCents === -item.amountCents && candidate.title === item.title ||
          !candidate.linkedPurchaseId && candidate.amountCents === item.amountCents && candidate.title.startsWith(item.title) &&
            /^ (?:Deposits & Credits|Withdrawals & Debits) Total /i.test(candidate.title.slice(item.title.length))));
      if (matches.length === 1) old = matches[0];
    }
    // A less specific or older export cannot undo a supplied bank status.
    if (old && rank[old.status] > rank[item.status]) continue;
    const next: AccountTransaction = { id: item.id, title: item.title.trim(), amountCents: item.amountCents, occurredAt: item.occurredAt,
      shadowPurchaseIds: old?.shadowPurchaseIds,
      sourcePage: item.sourcePage ?? old?.sourcePage, sourceLine: item.sourceLine ?? old?.sourceLine, sourceRow: item.sourceRow ?? old?.sourceRow, rawDescription: item.rawDescription ?? old?.rawDescription,
      source: item.source, status: item.status, sourceDate: item.sourceDate ?? old?.sourceDate ?? item.occurredAt.slice(0, 10), ...(old?.duplicateOf ? {duplicateOf:old.duplicateOf} : {}), accountLabel: item.accountLabel.trim(),
      ...(item.accountId ?? old?.accountId ? { accountId: item.accountId ?? old?.accountId } : {}),
      ...(item.recurringHint || old?.recurringHint ? { recurringHint: true } : {}),
      ...(item.transactionType ?? old?.transactionType ? { transactionType: item.transactionType ?? old?.transactionType } : {}),
      ...(item.linkedPurchaseId || old?.linkedPurchaseId ? { linkedPurchaseId: item.linkedPurchaseId && !old?.shadowPurchaseIds?.includes(item.linkedPurchaseId) ? item.linkedPurchaseId : old?.linkedPurchaseId } : {}) };
    if (!old) added++;
    else if (JSON.stringify(old) !== JSON.stringify(next)) updated++;
    if (old && old.id !== item.id) { transactions.delete(old.id); replacedIds.push({ from: old.id, to: item.id }); }
    transactions.set(item.id, next);
  }
  const replacements = new Map(replacedIds.map(pair => [pair.from,pair.to]));
  const resolved = [...transactions.values()].map(row => row.duplicateOf && replacements.has(row.duplicateOf) ? {...row,duplicateOf:replacements.get(row.duplicateOf)} : row);
  const corrected = { ...directions };
  for (const replacement of replacedIds) if (corrected[replacement.from]) { corrected[replacement.to] = corrected[replacement.from]; delete corrected[replacement.from]; }
  return { transactions: clearInvalidBankDuplicates(resolved, corrected).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)), added, updated, replacedIds };
}

export type SavingsAdjustment = { id: string; amountCents: number; createdAt: string; kind: 'reserve' | 'release' | 'assign'; goalId?: string; purchaseId?: string };

export type TransactionDirections = Record<string, 'in' | 'out'>;
export function effectiveBankTransaction(row: AccountTransaction, directions: TransactionDirections = {}): AccountTransaction & { directionCorrected?: boolean } {
  const direction = directions[row.id] ?? directions[row.linkedPurchaseId ?? ''];
  return direction ? { ...row, amountCents: Math.abs(row.amountCents) * (direction === 'in' ? 1 : -1), directionCorrected: true } : row;
}
export function clearInvalidBankDuplicates(rows: AccountTransaction[], directions: TransactionDirections = {}) {
  const byId = new Map(rows.map(row => [row.id, row]));
  return rows.map(row => row.duplicateOf && (!byId.has(row.duplicateOf) ||
    effectiveBankTransaction(row, directions).amountCents !== effectiveBankTransaction(byId.get(row.duplicateOf)!, directions).amountCents)
    ? { ...row, duplicateOf: undefined } : row);
}

export function pocketTransactions(bank: AccountTransaction[], purchases: LoggedPurchase[], adjustments: SavingsAdjustment[] = [], hiddenIds: string[] = [], directions: TransactionDirections = {}): PocketTransaction[] {
  const linked = new Set(bank.flatMap(item => [item.linkedPurchaseId,...(item.shadowPurchaseIds ?? [])]).filter(Boolean));
  const seen = new Set(bank.map((item) => item.id));
  const byPurchase = new Map(purchases.map((item) => [item.id, item]));
  const adjustmentPurchases = new Map(adjustments.map((item) => [`savings-${item.id}`, item.purchaseId]));
  const rows: PocketTransaction[] = bank.filter(item => !item.duplicateOf).map((item) => ({ ...effectiveBankTransaction(item, directions), purchase: item.linkedPurchaseId ? byPurchase.get(item.linkedPurchaseId) : undefined }));
  for (const purchase of purchases) {
    if (linked.has(purchase.id) || seen.has(purchase.id) || !Number.isSafeInteger(purchase.amountCents) || purchase.amountCents <= 0 || !Number.isFinite(Date.parse(purchase.purchasedAt))) continue;
    seen.add(purchase.id);
    rows.push({ id: purchase.id, title: purchase.title, amountCents: -purchase.amountCents, occurredAt: purchase.purchasedAt,
      source: purchase.source === 'bank-import' ? purchase.bankSource ?? 'csv' : purchase.source === 'shortcut' ? 'shortcut' : 'manual',
      status: purchase.bankSource === 'citizens-pdf' ? 'posted' : purchase.source === 'bank-import' ? 'recorded' : 'logged',
      accountLabel: purchase.bankAccountLabel ?? '', ...(purchase.bankAccountId ? { accountId: purchase.bankAccountId } : {}), purchase });
  }
  for (const item of adjustments) {
    // The purchase detail already shows the savings contribution for this entry.
    if (item.purchaseId && byPurchase.has(item.purchaseId)) continue;
    if (!Number.isSafeInteger(item.amountCents) || item.amountCents <= 0 || !Number.isFinite(Date.parse(item.createdAt))) continue;
    rows.push({ id: `savings-${item.id}`, title: item.kind === 'assign' ? 'Assigned savings to goal' : item.kind === 'reserve' ? 'Money set aside' : 'Set-aside reduced',
      amountCents: item.kind === 'release' ? -item.amountCents : item.amountCents, occurredAt: item.createdAt, source: 'savings', status: 'adjustment', accountLabel: '', adjustmentKind: item.kind });
  }
  const hidden = new Set(hiddenIds);
  return rows.map(row => {
    const direction = directions[row.id] ?? directions[row.linkedPurchaseId ?? row.purchase?.id ?? ''];
    if (!['csv', 'citizens-pdf'].includes(row.source) || !['in', 'out'].includes(direction)) return row;
    return { ...row, amountCents: Math.abs(row.amountCents) * (direction === 'in' ? 1 : -1), directionCorrected: true };
  }).filter((row) => !hidden.has(row.id) && !hidden.has(row.linkedPurchaseId ?? row.purchase?.id ?? '') &&
    // A deleted purchase can leave its savings entry visible. Keep that entry
    // hidden too when the user removed the purchase from history.
    !(row.source === 'savings' && hidden.has(adjustmentPurchases.get(row.id) ?? '')))
    .sort((a, b) => transactionDay(b).localeCompare(transactionDay(a)) || Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export function setTransactionDirection(rows: PocketTransaction[], directions: TransactionDirections, id: string, direction: 'in' | 'out' | null) {
  const row = rows.find(row => row.id === id && ['csv', 'citizens-pdf'].includes(row.source));
  if (!row || direction !== null && !['in', 'out'].includes(direction)) return directions;
  const next = { ...directions };
  for (const key of [row.id, row.linkedPurchaseId ?? row.purchase?.id].filter((key): key is string => !!key)) {
    if (direction === null) delete next[key]; else next[key] = direction;
  }
  return next;
}

// Keep the original records for duplicate matching, balances and subscriptions.
// Remember both identities so a linked bank row or purchase cannot resurface.
export function hideTransactionFromHistory(rows: PocketTransaction[], hiddenIds: string[], id: string) {
  const row = rows.find((item) => item.id === id);
  if (!row) return { hiddenIds, removedIds: [] as string[] };
  const hidden = new Set(hiddenIds);
  const removedIds = [row.id, row.linkedPurchaseId ?? row.purchase?.id].filter((value): value is string => !!value && !hidden.has(value));
  return { hiddenIds: [...new Set([...hiddenIds, ...removedIds])], removedIds: [...new Set(removedIds)] };
}

// A bank movement and its savings purchase describe the same charge. Keep the
// bank row in Account while preserving the purchase for savings and subscriptions.
export function linkAccountTransactions<T extends AccountTransaction & { rowNumber: number }>(
  movements: T[], purchases: { rowNumber: number; id: string; duplicate: 'known' | 'possible' | null; matchId?: string }[], selectedIds: Set<string>,
): T[] {
  const byRow = new Map(purchases.map((item) => [item.rowNumber, item]));
  return movements.map((item) => {
    const purchase = byRow.get(item.rowNumber);
    const linkedPurchaseId = purchase && (selectedIds.has(purchase.id) ? purchase.id : purchase.matchId ?? (purchase.duplicate === 'known' ? purchase.id : undefined));
    return linkedPurchaseId ? { ...item, linkedPurchaseId } : item;
  });
}

export function filterTransactions(rows: PocketTransaction[], query: string, filter: 'all' | 'out' | 'in' | 'pending' | 'savings') {
  const search = query.trim().toLowerCase();
  return rows.filter((item) => (!search || `${transactionDisplayName(item)} ${item.title} ${item.rawDescription ?? ""} ${item.accountLabel} ${item.details?.category ?? ""} ${item.details?.note ?? ""}`.toLowerCase().includes(search)) &&
    (filter === 'all' || filter === 'savings' && item.source === 'savings' || filter === 'in' && item.source !== 'savings' && item.amountCents > 0 || filter === 'out' && item.source !== 'savings' && item.amountCents < 0 || filter === 'pending' && item.status === 'pending'));
}

export function transactionDisplayName(transaction: Pick<PocketTransaction, 'title' | 'source' | 'displayMerchant'>) {
  if (transaction.displayMerchant) return transaction.displayMerchant;
  return transaction.source === 'citizens-pdf' || transaction.source === 'csv' ? bankTransactionName(transaction.title) : transaction.title;
}
