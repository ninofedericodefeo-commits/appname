import { transactionDay } from './dates.ts';
import { effectiveBankTransaction } from './transactions.ts';
import type { AccountTransaction, TransactionDirections } from './transactions.ts';
import type { LoggedPurchase } from '../goals/logic.ts';
import { accountContains } from '../bank/accountIdentity.ts';
import type { LinkedBankAccount } from '../bank/accountIdentity.ts';

const week = 7 * 86400_000;
export type SeparatePurchaseDecision = {
  id: string; kind: 'bank-bank' | 'bank-purchase'; bankId: string; otherId: string;
  evidence: string; createdAt: string; undoneAt?: string;
};
export type ReviewOptions = {
  directions?: TransactionDirections; separateDecisions?: SeparatePurchaseDecision[];
  offset?: number; limit?: number; query?: string; pair?: readonly [string, string];
};
function bankEvidence(row: AccountTransaction, directions: TransactionDirections) {
  return [row.accountId ?? row.accountLabel.trim().toLowerCase(), row.title.trim().toLowerCase(),
    row.amountCents, effectiveBankTransaction(row, directions).amountCents, transactionDay(row), row.occurredAt, row.status];
}
export function separationEvidence(kind: SeparatePurchaseDecision['kind'], bank: AccountTransaction,
  other: AccountTransaction | LoggedPurchase, directions: TransactionDirections = {}) {
  const first = JSON.stringify(bankEvidence(bank, directions));
  if (kind === 'bank-bank' && 'occurredAt' in other) return JSON.stringify([kind, ...[first, JSON.stringify(bankEvidence(other, directions))].sort()]);
  if (kind === 'bank-purchase' && 'purchasedAt' in other) return JSON.stringify([kind, first,
    other.bankAccountId ?? other.bankAccountLabel?.trim().toLowerCase() ?? '', other.title.trim().toLowerCase(), other.amountCents, other.purchasedAt]);
  throw Error('Check the purchase pair before saving this decision.');
}
function pairKey(kind: SeparatePurchaseDecision['kind'], a: string, b: string) {
  return JSON.stringify([kind, ...(kind === 'bank-bank' ? [a,b].sort() : [a,b])]);
}
function separatePairs(decisions: SeparatePurchaseDecision[] = []) {
  const pairs = new Map<string, Set<string>>();
  for (const decision of decisions) if (!decision.undoneAt) {
    const key = pairKey(decision.kind, decision.bankId, decision.otherId), evidence = pairs.get(key) ?? new Set<string>();
    evidence.add(decision.evidence); pairs.set(key,evidence);
  }
  return pairs;
}
export function separationStillApplies(decision: SeparatePurchaseDecision, rows: AccountTransaction[], purchases: LoggedPurchase[], directions: TransactionDirections = {}) {
  if (decision.undoneAt) return false;
  const bank = rows.find(row => row.id === decision.bankId);
  const other = decision.kind === 'bank-bank' ? rows.find(row => row.id === decision.otherId) : purchases.find(purchase => purchase.id === decision.otherId);
  return !!bank && !!other && !bank.duplicateOf && !('duplicateOf' in other && other.duplicateOf) &&
    decision.evidence === separationEvidence(decision.kind, bank, other, directions);
}
function matchesQuery(query: string | undefined, row: AccountTransaction, other: AccountTransaction | LoggedPurchase) {
  const terms = query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const text = `${row.title} ${row.sourceDate ?? row.occurredAt} ${row.accountLabel} ${(row.amountCents/100).toFixed(2)} ${other.title} ${'occurredAt' in other ? other.sourceDate ?? other.occurredAt : other.purchasedAt}`.toLowerCase();
  return terms.every(term => text.includes(term));
}
export function matchCandidates(rows: AccountTransaction[], purchases: LoggedPurchase[], account: LinkedBankAccount | null, options: ReviewOptions = {}) {
  const directions = options.directions ?? {}, excluded = separatePairs(options.separateDecisions);
  const byPurchase = new Map(purchases.map(purchase => [purchase.id,purchase]));
  const used = new Set(rows.flatMap(row => [row.linkedPurchaseId,...(row.shadowPurchaseIds ?? [])]));
  const groups = new Map<string,LoggedPurchase[]>();
  for (const purchase of purchases) {
    if (options.pair && purchase.id !== options.pair[1] || used.has(purchase.id) || purchase.source === 'bank-import' || !Number.isFinite(Date.parse(purchase.purchasedAt)) || account && (purchase.bankAccountId || purchase.bankAccountLabel) && !accountContains(account,purchase.bankAccountLabel ?? '',purchase.bankAccountId)) continue;
    const key = `${purchase.amountCents}:${Math.floor(Date.parse(purchase.purchasedAt)/week)}`;
    const group = groups.get(key) ?? []; group.push(purchase); groups.set(key,group);
  }
  const result: {row:ReturnType<typeof effectiveBankTransaction>;purchase:LoggedPurchase}[] = [];
  const limit = options.limit ?? 100, offset = options.offset ?? 0; let count = 0;
  for (const original of rows) {
    const row = effectiveBankTransaction(original, directions);
    if (options.pair && row.id !== options.pair[0] || row.duplicateOf || row.linkedPurchaseId && byPurchase.get(row.linkedPurchaseId)?.source !== 'bank-import' || row.amountCents >= 0 || row.status === 'pending' || account && !accountContains(account,row.accountLabel,row.accountId)) continue;
    const at = Date.parse(row.occurredAt), bucket = Math.floor(at/week);
    for (const relative of [-1,0,1]) for (const purchase of groups.get(`${-row.amountCents}:${bucket+relative}`) ?? []) {
      if (Math.abs(at-Date.parse(purchase.purchasedAt)) > week || !matchesQuery(options.query,row,purchase)) continue;
      const ignored = excluded.get(pairKey('bank-purchase',row.id,purchase.id));
      if (ignored?.has(separationEvidence('bank-purchase',original,purchase,directions))) continue;
      if (count++ >= offset) result.push({row,purchase});
      if (result.length >= limit) return result;
    }
  }
  return result;
}
export type MatchRevision = { id:string;bankId:string;purchaseId:string;createdAt:string;undoneAt?:string;previousLinkedPurchaseId?:string;previousShadowPurchaseIds?:string[] };
export type BankDuplicateRevision = {id:string;bankId:string;canonicalId:string;createdAt:string;undoneAt?:string};
export function bankDuplicateCandidates(rows: AccountTransaction[], account: LinkedBankAccount | null, options: ReviewOptions = {}) {
  const directions = options.directions ?? {}, excluded = separatePairs(options.separateDecisions), originals = new Map(rows.map(row => [row.id,row]));
  const groups = new Map<string,ReturnType<typeof effectiveBankTransaction>[]>(), pairs: {row:ReturnType<typeof effectiveBankTransaction>;canonical:ReturnType<typeof effectiveBankTransaction>}[] = [];
  const eligible = rows.filter(row => (!options.pair || options.pair.includes(row.id)) && !row.duplicateOf && (!account || accountContains(account,row.accountLabel,row.accountId)))
    .map(row => effectiveBankTransaction(row,directions)).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const limit = options.limit ?? 100, offset = options.offset ?? 0; let count = 0;
  for (const row of eligible) {
    const name = row.title.toLowerCase().replace(/\d+/g,'').replace(/[^a-z]/g,'');
    if (name.length < 3) continue;
    const key = JSON.stringify([row.accountId ?? row.accountLabel,row.amountCents,name]), at = Date.parse(row.occurredAt);
    const group = (groups.get(key) ?? []).filter(other => Math.abs(at-Date.parse(other.occurredAt)) <= week);
    for (const other of group) {
      if (!matchesQuery(options.query,row,other)) continue;
      const ignored = excluded.get(pairKey('bank-bank',row.id,other.id));
      if (ignored?.has(separationEvidence('bank-bank',originals.get(row.id)!,originals.get(other.id)!,directions))) continue;
      const posted = row.status === 'posted' && other.status !== 'posted';
      if (count++ >= offset) pairs.push(posted ? {row:other,canonical:row} : {row,canonical:other});
      if (pairs.length >= limit) return pairs;
    }
    group.push(row);groups.set(key,group);
  }
  return pairs;
}

// A later decision for the same bank row takes precedence, even if it happened
// to choose the same destination. Older Undo buttons must not undo that choice.
export function isCurrentReviewRevision(history: readonly { id: string; bankId: string; undoneAt?: string }[], revision: { id: string; bankId: string }) {
  for (let index = history.length - 1; index >= 0; index--) if (history[index].bankId === revision.bankId && !history[index].undoneAt) return history[index].id === revision.id;
  return false;
}
