import type { TransactionDetails, TransactionRevision } from '../pocket/repository.ts';
import { applyBankImport, parseBankDate } from './importLogic.ts';
import type { BankImportState, BankPreviewRow, BankPurchase } from './importLogic.ts';
import { mergeAccountTransactions } from '../pocket/transactions.ts';
import type { AccountTransaction, TransactionDirections } from '../pocket/transactions.ts';
import { accountNamespace, accountNickname, renameLinkedAccount, resolveLinkedAccount } from './accountIdentity.ts';
import type { BankAccountInput, LinkedBankAccount } from './accountIdentity.ts';
import { accountBalanceEstimate } from '../pocket/balanceEstimate.ts';

export type StatementBalance = { amountCents: number; asOf: string; page: number; line: number };
export type AccountImportState = BankImportState & {
  linkedBankAccount?: LinkedBankAccount | null;
  balanceIncludedTransactionIds?: string[];
  accountTransactions: AccountTransaction[];
  hiddenTransactionIds?: string[];
  transactionDirections?: TransactionDirections;
  transactionDetails?: Record<string, TransactionDetails>;
  correctionHistory?: TransactionRevision[];
  balanceUpdatedAt?: string | null;
  balanceAsOf?: string | null;
  balanceSource?: 'manual' | 'citizens-pdf' | null;
  statementBalanceKeys?: string[];
};
export type AccountImportOptions = { matches?: BankPreviewRow[]; balance?: StatementBalance | null; statementIdentifier?: string | null };

export function statementBalanceKey(balance: StatementBalance, account: BankAccountInput) {
  return JSON.stringify([accountNamespace(account), balance.asOf, balance.amountCents]);
}
export function statementBalanceStatus(state: AccountImportState, balance: StatementBalance, account: BankAccountInput, now = new Date()) {
  if (!Number.isSafeInteger(balance.amountCents) || Math.abs(balance.amountCents) > 100_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(balance.asOf) || !parseBankDate(balance.asOf, 'mdy', now)) return 'invalid';
  if (state.statementBalanceKeys?.includes(statementBalanceKey(balance, account)) && state.reportedBalanceCents === balance.amountCents && state.balanceAsOf === balance.asOf && state.balanceSource === 'citizens-pdf') return 'applied';
  return state.balanceAsOf && balance.asOf < state.balanceAsOf ? 'older' : 'new';
}

export function applyAccountImport(state: AccountImportState, candidates: BankPurchase[], applyRule: boolean, account: BankAccountInput, history: AccountTransaction[], options: AccountImportOptions = {}, now = new Date()) {
  const profile = typeof account === 'string' ? null : resolveLinkedAccount({ ...state, linkedBankAccount: state.linkedBankAccount ?? account }, account.nickname, options.statementIdentifier ?? account.statementIdentifier);
  const balance = options.balance;
  const status = balance ? statementBalanceStatus(state, balance, account, now) : 'invalid';
  // A confirmed statement sets the closing balance; its debits are already
  // included in that amount. Savings rules are capped against the new balance.
  const balanceUpdated = !!balance && (status === 'new' || status === 'older');
  const withBalance: AccountImportState = balanceUpdated ? { ...state,
    reportedBalanceCents: balance!.amountCents, balanceAsOf: balance!.asOf, balanceSource: 'citizens-pdf', balanceUpdatedAt: now.toISOString(),
    ...(state.balanceIncludedTransactionIds ? { balanceIncludedTransactionIds: [] } : {}),
    statementBalanceKeys: [...new Set([...(state.statementBalanceKeys ?? []), statementBalanceKey(balance!, account)])],
  } : state;
  const existingHistory = profile ? renameLinkedAccount(state, profile).accountTransactions : state.accountTransactions;
  const movements = mergeAccountTransactions(existingHistory, history, now);
  const hidden = new Set(state.hiddenTransactionIds ?? []);
  const directions = { ...(state.transactionDirections ?? {}) };
  for (const replacement of movements.replacedIds) if (hidden.has(replacement.from)) hidden.add(replacement.to);
  for (const replacement of movements.replacedIds) if (directions[replacement.from]) {
    directions[replacement.to] = directions[replacement.from]; delete directions[replacement.from];
  }
  const details = { ...(state.transactionDetails ?? {}) };
  for (const replacement of movements.replacedIds) if (details[replacement.from]) details[replacement.to] ??= details[replacement.from];
  const replacements = new Map(movements.replacedIds.map(item => [item.from, item.to]));
  const correctionHistory = state.correctionHistory?.map(item => replacements.has(item.transactionId) ? { ...item, originalTransactionId: item.originalTransactionId ?? item.transactionId, transactionId: replacements.get(item.transactionId)! } : item);
  const virtualPurchases = new Map(state.purchases.map(purchase => [purchase.id, purchase]));
  const latest = new Date(now); latest.setHours(23, 59, 59, 999);
  for (const candidate of candidates) if (!virtualPurchases.has(candidate.id) && !state.bankImportKeys.includes(candidate.id) && /^bank-[a-f0-9]{16}$/.test(candidate.id) &&
    candidate.title.trim() && candidate.title.trim().length <= 80 && Number.isSafeInteger(candidate.amountCents) && candidate.amountCents > 0 && candidate.amountCents <= 100_000_000 && Number.isFinite(Date.parse(candidate.purchasedAt)) && Date.parse(candidate.purchasedAt) <= latest.getTime()) {
    virtualPurchases.set(candidate.id, { ...candidate, source: 'bank-import', decision: 'pending' });
  }
  const ruleBalance = accountBalanceEstimate({ ...withBalance, ...(profile ? { linkedBankAccount: profile } : {}), purchases: [...virtualPurchases.values()], accountTransactions: movements.transactions, transactionDirections: directions }).estimatedCents;
  const result = applyBankImport(withBalance, candidates, applyRule, now, ruleBalance);
  const keys = new Set(result.state.bankImportKeys);
  const matched = new Map<string, BankPreviewRow[]>();
  for (const row of options.matches ?? []) {
    if (row.duplicate !== 'possible' || !row.matchId || keys.has(row.id) || !state.purchases.some((purchase) => purchase.id === row.matchId)) continue;
    const rows = matched.get(row.matchId) ?? [];
    rows.push(row); matched.set(row.matchId, rows); keys.add(row.id);
  }
  const purchases = result.state.purchases.map((purchase) => {
    const rows = matched.get(purchase.id);
    if (!rows) return purchase;
    return { ...purchase, bankMatchKeys: [...new Set([...(purchase.bankMatchKeys ?? []), ...rows.map((row) => row.id)])],
      bankDescription: rows[0].title, bankPostedAt: rows[0].purchasedAt,
      bankSource: rows[0].bankSource, bankAccountLabel: accountNickname(account), ...(profile ? { bankAccountId: profile.id } : {}), recurringHint: purchase.recurringHint || rows.some((row) => row.recurringHint) };
  });
  return { state: { ...withBalance, ...result.state, purchases, bankImportKeys: [...keys], accountTransactions: movements.transactions,
    ...(profile ? renameLinkedAccount({ ...state, purchases, accountTransactions: movements.transactions }, profile) : {}),
    ...(state.hiddenTransactionIds ? { hiddenTransactionIds: [...hidden] } : {}),
    ...(state.transactionDetails ? { transactionDetails: details } : {}), ...(correctionHistory ? { correctionHistory } : {}),
    ...(state.transactionDirections ? { transactionDirections: directions } : {}) },
    imported: result.imported, skipped: result.skipped, savedCents: result.savedCents,
    matched: matched.size, balanceUpdated, transactionsAdded: movements.added, transactionsUpdated: movements.updated };
}
