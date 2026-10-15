import { transactionDay } from './dates.ts';
import { accountContains } from '../bank/accountIdentity.ts';
import type { LinkedBankAccount } from '../bank/accountIdentity.ts';
import type { LoggedPurchase } from '../goals/logic.ts';
import { pocketTransactions } from './transactions.ts';
import type { AccountTransaction, TransactionDirections } from './transactions.ts';

export type BalanceEstimateState = {
  reportedBalanceCents: number | null; balanceAsOf?: string | null; balanceUpdatedAt?: string | null;
  balanceSource?: string | null; balanceIncludedTransactionIds?: string[]; linkedBankAccount?: LinkedBankAccount | null;
  purchases: LoggedPurchase[]; accountTransactions: AccountTransaction[]; transactionDirections?: TransactionDirections;
};
const localDay = (iso: string) => { const date = new Date(iso); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

export function belongsToLinkedAccount(row: { accountId?: string; accountLabel: string; source: string }, account?: LinkedBankAccount | null) {
  return !account || !row.accountLabel && !row.accountId || row.source === 'savings' || accountContains(account, row.accountLabel, row.accountId);
}

export function balanceSnapshotIds(state: Pick<BalanceEstimateState, 'accountTransactions' | 'purchases'>) {
  return pocketTransactions(state.accountTransactions, state.purchases).filter(row => row.status !== 'pending')
    .flatMap(row => [row.id, ...(row.linkedPurchaseId ? [row.linkedPurchaseId] : [])]);
}

export function accountBalanceEstimate(state: BalanceEstimateState) {
  const confirmedCents = state.reportedBalanceCents;
  const rows = pocketTransactions(state.accountTransactions, state.purchases, [], [], state.transactionDirections)
    .filter(row => belongsToLinkedAccount(row, state.linkedBankAccount));
  const included = new Set(state.balanceIncludedTransactionIds ?? []);
  const checkedAt = state.balanceUpdatedAt ? Date.parse(state.balanceUpdatedAt) : NaN;
  const snapshotDay = state.balanceSource === 'citizens-pdf' ? state.balanceAsOf : Number.isFinite(checkedAt) ? state.balanceAsOf ?? localDay(state.balanceUpdatedAt!) : null;
  let deltaCents = 0, newerCount = 0, pendingCount = 0, depositsCents = 0, spendingCents = 0;
  for (const row of rows) {
    if (row.status === 'pending') { pendingCount++; continue; }
    if (confirmedCents === null || !snapshotDay) continue;
    let newer = transactionDay(row) > snapshotDay;
    if (state.balanceSource !== 'citizens-pdf') {
      // A checked balance already incorporates known app records. Bank CSV dates
      // have no time of day: never assume their synthetic noon is a posting time.
      if (included.has(row.id) || included.has(row.linkedPurchaseId ?? row.purchase?.id ?? '')) continue;
      const localPurchase = row.purchase && row.purchase.source !== 'bank-import' ? row.purchase : null;
      if (row.source === 'manual' || row.source === 'shortcut' || localPurchase) newer = Date.parse(localPurchase?.purchasedAt ?? row.occurredAt) >= checkedAt;
    }
    if (newer) { deltaCents += row.amountCents; newerCount++; if (row.amountCents > 0) depositsCents += row.amountCents; else spendingCents -= row.amountCents; }
  }
  return { confirmedCents, estimatedCents: confirmedCents === null ? null : confirmedCents + deltaCents,
    deltaCents, depositsCents, spendingCents, newerCount, pendingCount, snapshotDay, canEstimate: !!snapshotDay };
}
