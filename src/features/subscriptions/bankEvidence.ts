import type { TransactionDetails } from '../pocket/repository.ts';
import { pocketTransactions } from '../pocket/transactions.ts';
import type { AccountTransaction, TransactionDirections } from '../pocket/transactions.ts';
import { belongsToLinkedAccount } from '../pocket/balanceEstimate.ts';
import type { LinkedBankAccount } from '../bank/accountIdentity.ts';
import type { LoggedPurchase } from '../goals/logic.ts';
import type { Subscription } from './logic.ts';
import { bankMerchant } from './bankSuggestions.ts';

export function subscriptionBankEvidence(bank: AccountTransaction[], purchases: LoggedPurchase[], directions: TransactionDirections = {}, account?: LinkedBankAccount | null, details: Record<string, TransactionDetails> = {}): LoggedPurchase[] {
  const ledgerIds = new Set(bank.map(row => row.id));
  // Hidden rows still count as evidence; corrections and pending state do matter.
  return pocketTransactions(bank, purchases, [], [], directions).filter(row => (['csv', 'citizens-pdf'].includes(row.source) || row.purchase?.bankSource) && row.amountCents < 0 && row.status !== 'pending' &&
    !['transfer', 'refund', 'reversal'].includes(details[row.id]?.classification ?? details[row.linkedPurchaseId ?? row.purchase?.id ?? '']?.classification ?? '') &&
    !/^(?:transfer|payment|credit card payment|card payment|balance payment|fee|refund|reversal)$/.test(row.transactionType ?? '') && belongsToLinkedAccount(row, account))
    .map(row => ({ id: row.id, title: !ledgerIds.has(row.id) && row.purchase?.bankDescription ? row.purchase.bankDescription : row.title,
      amountCents: -row.amountCents, purchasedAt: !ledgerIds.has(row.id) && row.purchase?.bankPostedAt ? row.purchase.bankPostedAt : row.occurredAt, source: 'bank-import',
      bankSource: ['csv', 'citizens-pdf'].includes(row.source) ? row.source as 'csv' | 'citizens-pdf' : row.purchase!.bankSource,
      bankAccountLabel: row.accountLabel, recurringHint: row.recurringHint || row.purchase?.recurringHint, decision: 'skipped' }));
}

export type SubscriptionBankAlert = { id: string; subscription: Subscription; charge: LoggedPurchase; kind: 'price-change' | 'charge-after-cancel' };
const day = (iso: string) => { const date = new Date(iso); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export function subscriptionBankAlerts(evidence: LoggedPurchase[], subscriptions: Subscription[], dismissed: string[] = []): SubscriptionBankAlert[] {
  const alerts: SubscriptionBankAlert[] = [];
  for (const subscription of subscriptions.filter(item => !item.isSample)) {
    const key = subscription.bankMerchantKey ?? bankMerchant(subscription.name).key;
    const anchor = subscription.active ? subscription.amountUpdatedAt ?? subscription.createdAt : subscription.canceledAt;
    if (!anchor || !Number.isFinite(Date.parse(anchor))) continue;
    const charge = evidence.filter(row => bankMerchant(row.title).key === key && day(row.purchasedAt) > day(anchor) && !/\b(?:refund|reversal|transfer|fee)\b/i.test(row.title)).sort((a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt))[0];
    if (!charge || subscription.active && charge.amountCents === subscription.amountCents) continue;
    const kind = subscription.active ? 'price-change' : 'charge-after-cancel';
    const id = `${subscription.id}|${charge.id}|${charge.amountCents}|${kind}`;
    if (!dismissed.includes(id)) alerts.push({ id, subscription, charge, kind });
  }
  return alerts;
}

export function subscriptionRefunds(bank: AccountTransaction[], purchases: LoggedPurchase[], directions: TransactionDirections = {}, account?: LinkedBankAccount | null, details: Record<string, TransactionDetails> = {}) {
  return pocketTransactions(bank, purchases, [], [], directions).filter(row => ['csv', 'citizens-pdf'].includes(row.source) && row.status !== 'pending' && row.amountCents > 0 && belongsToLinkedAccount(row, account) &&
    (details[row.id]?.classification === 'refund' || details[row.id]?.classification === 'reversal' || /refund|reversal/i.test(row.transactionType ?? '') || /\brefund|reversal\b/i.test(row.title)))
    .map(row => ({ id: row.id, date: row.occurredAt, amountCents: row.amountCents, merchantKey: bankMerchant(row.title.replace(/\b(?:refund|reversal|credit)\b/gi, ' ')).key }));
}
