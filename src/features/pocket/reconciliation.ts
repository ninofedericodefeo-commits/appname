import type { AccountTransaction } from './transactions.ts';
import type { LoggedPurchase } from '../goals/logic.ts';
import { accountContains } from '../bank/accountIdentity.ts';
import type { LinkedBankAccount } from '../bank/accountIdentity.ts';
const week = 7 * 86400_000;
export function matchCandidates(rows: AccountTransaction[], purchases: LoggedPurchase[], account: LinkedBankAccount | null) {
  const byPurchase = new Map(purchases.map(purchase => [purchase.id,purchase]));
  const used = new Set(rows.flatMap(row => [row.linkedPurchaseId,...(row.shadowPurchaseIds ?? [])]));
  const groups = new Map<string,LoggedPurchase[]>();
  for (const purchase of purchases) {
    if (used.has(purchase.id) || purchase.source === 'bank-import' || !Number.isFinite(Date.parse(purchase.purchasedAt)) || account && (purchase.bankAccountId || purchase.bankAccountLabel) && !accountContains(account,purchase.bankAccountLabel ?? '',purchase.bankAccountId)) continue;
    const key = `${purchase.amountCents}:${Math.floor(Date.parse(purchase.purchasedAt)/week)}`;
    const group = groups.get(key) ?? []; group.push(purchase); groups.set(key,group);
  }
  const result: {row:AccountTransaction;purchase:LoggedPurchase}[] = [];
  for (const row of rows) {
    if (row.duplicateOf || row.linkedPurchaseId && byPurchase.get(row.linkedPurchaseId)?.source !== 'bank-import' || row.amountCents >= 0 || row.status === 'pending' || account && !accountContains(account,row.accountLabel,row.accountId)) continue;
    const at = Date.parse(row.occurredAt), bucket = Math.floor(at/week);
    for (const offset of [-1,0,1]) for (const purchase of groups.get(`${-row.amountCents}:${bucket+offset}`) ?? []) {
      if (Math.abs(at-Date.parse(purchase.purchasedAt)) <= week) result.push({row,purchase});
      if (result.length >= 100) return result;
    }
  }
  return result;
}
export type MatchRevision = { id:string;bankId:string;purchaseId:string;createdAt:string;undoneAt?:string;previousLinkedPurchaseId?:string;previousShadowPurchaseIds?:string[] };
export type BankDuplicateRevision = {id:string;bankId:string;canonicalId:string;createdAt:string;undoneAt?:string};
export function bankDuplicateCandidates(rows: AccountTransaction[], account: LinkedBankAccount | null) {
  const groups = new Map<string,AccountTransaction[]>(), pairs: {row:AccountTransaction;canonical:AccountTransaction}[] = [];
  const eligible = rows.filter(row => !row.duplicateOf && (!account || accountContains(account,row.accountLabel,row.accountId))).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  for (const row of eligible) {
    const name = row.title.toLowerCase().replace(/\d+/g,'').replace(/[^a-z]/g,'');
    if (name.length < 3) continue;
    const key = JSON.stringify([row.accountId ?? row.accountLabel,row.amountCents,name]), at = Date.parse(row.occurredAt);
    const group = (groups.get(key) ?? []).filter(other => Math.abs(at-Date.parse(other.occurredAt)) <= week);
    for (const other of group) {
      const posted = row.status === 'posted' && other.status !== 'posted';
      pairs.push(posted ? {row:other,canonical:row} : {row,canonical:other});
      if (pairs.length >= 100) return pairs;
    }
    group.push(row);groups.set(key,group);
  }
  return pairs;
}
