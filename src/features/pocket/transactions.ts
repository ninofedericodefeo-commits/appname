import type { LoggedPurchase } from '../goals/logic.ts';

export type AccountTransaction = {
  id: string;
  title: string;
  // Signed account movement: credits positive, debits negative.
  amountCents: number;
  occurredAt: string;
  source: 'csv' | 'citizens-pdf';
  status: 'posted' | 'pending' | 'recorded';
  accountLabel: string;
  linkedPurchaseId?: string;
};

export type PocketTransaction = Omit<AccountTransaction, 'source' | 'status'> & {
  source: AccountTransaction['source'] | 'manual' | 'shortcut';
  status: AccountTransaction['status'] | 'logged';
};

export function mergeAccountTransactions(existing: AccountTransaction[], incoming: AccountTransaction[], now = new Date()) {
  const transactions = new Map(existing.map((item) => [item.id, item]));
  const latest = new Date(now); latest.setHours(23, 59, 59, 999);
  const rank = { recorded: 0, pending: 1, posted: 2 };
  let added = 0, updated = 0;
  for (const item of incoming) {
    if (!/^account-[a-f0-9]{16}$/.test(item.id) || !item.title.trim() || item.title.length > 80 ||
      !Number.isSafeInteger(item.amountCents) || item.amountCents === 0 || Math.abs(item.amountCents) > 100_000_000 ||
      !Number.isFinite(Date.parse(item.occurredAt)) || Date.parse(item.occurredAt) > latest.getTime() ||
      !['csv', 'citizens-pdf'].includes(item.source) || !['pending', 'recorded', 'posted'].includes(item.status) || !item.accountLabel.trim() || item.accountLabel.length > 60) continue;
    const old = transactions.get(item.id);
    // A less specific or older export cannot undo a supplied bank status.
    if (old && rank[old.status] > rank[item.status]) continue;
    const next: AccountTransaction = { id: item.id, title: item.title.trim(), amountCents: item.amountCents, occurredAt: item.occurredAt,
      source: item.source, status: item.status, accountLabel: item.accountLabel.trim(),
      ...(item.linkedPurchaseId || old?.linkedPurchaseId ? { linkedPurchaseId: item.linkedPurchaseId ?? old?.linkedPurchaseId } : {}) };
    if (!old) added++;
    else if (JSON.stringify(old) !== JSON.stringify(next)) updated++;
    transactions.set(item.id, next);
  }
  return { transactions: [...transactions.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)), added, updated };
}

export function pocketTransactions(bank: AccountTransaction[], purchases: LoggedPurchase[]): PocketTransaction[] {
  const linked = new Set(bank.map((item) => item.linkedPurchaseId).filter(Boolean));
  const seen = new Set(bank.map((item) => item.id));
  const rows: PocketTransaction[] = [...bank];
  for (const purchase of purchases) {
    if (linked.has(purchase.id) || seen.has(purchase.id) || !Number.isSafeInteger(purchase.amountCents) || purchase.amountCents <= 0 || !Number.isFinite(Date.parse(purchase.purchasedAt))) continue;
    seen.add(purchase.id);
    rows.push({ id: purchase.id, title: purchase.title, amountCents: -purchase.amountCents, occurredAt: purchase.purchasedAt,
      source: purchase.source === 'bank-import' ? purchase.bankSource ?? 'csv' : purchase.source === 'shortcut' ? 'shortcut' : 'manual',
      status: purchase.bankSource === 'citizens-pdf' ? 'posted' : purchase.source === 'bank-import' ? 'recorded' : 'logged',
      accountLabel: purchase.bankAccountLabel ?? '' });
  }
  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

// A bank movement and its savings purchase describe the same charge. Keep the
// bank row in Pocket while preserving the purchase in Goals and subscriptions.
export function linkAccountTransactions<T extends AccountTransaction & { rowNumber: number }>(
  movements: T[], purchases: { rowNumber: number; id: string; duplicate: 'known' | 'possible' | null; matchId?: string }[], selectedIds: Set<string>,
): T[] {
  const byRow = new Map(purchases.map((item) => [item.rowNumber, item]));
  return movements.map((item) => {
    const purchase = byRow.get(item.rowNumber);
    const linkedPurchaseId = purchase && (selectedIds.has(purchase.id) || purchase.duplicate === 'known' ? purchase.id : purchase.matchId);
    return linkedPurchaseId ? { ...item, linkedPurchaseId } : item;
  });
}
