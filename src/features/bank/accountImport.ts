import { applyBankImport, parseBankDate } from './importLogic.ts';
import type { BankImportState, BankPreviewRow, BankPurchase } from './importLogic.ts';
import { mergeAccountTransactions } from '../pocket/transactions.ts';
import type { AccountTransaction } from '../pocket/transactions.ts';

export type StatementBalance = { amountCents: number; asOf: string; page: number; line: number };
export type AccountImportState = BankImportState & {
  accountTransactions: AccountTransaction[];
  balanceUpdatedAt?: string | null;
  balanceAsOf?: string | null;
  balanceSource?: 'manual' | 'citizens-pdf' | null;
  statementBalanceKeys?: string[];
};
export type AccountImportOptions = { matches?: BankPreviewRow[]; balance?: StatementBalance | null };

export function statementBalanceKey(balance: StatementBalance, account: string) {
  return JSON.stringify([account.trim().toLowerCase(), balance.asOf, balance.amountCents]);
}
export function statementBalanceStatus(state: AccountImportState, balance: StatementBalance, account: string, now = new Date()) {
  if (!Number.isSafeInteger(balance.amountCents) || Math.abs(balance.amountCents) > 100_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(balance.asOf) || !parseBankDate(balance.asOf, 'mdy', now)) return 'invalid';
  if (state.statementBalanceKeys?.includes(statementBalanceKey(balance, account))) return 'applied';
  return state.balanceAsOf && balance.asOf < state.balanceAsOf ? 'older' : 'new';
}

export function applyAccountImport(state: AccountImportState, candidates: BankPurchase[], applyRule: boolean, account: string, history: AccountTransaction[], options: AccountImportOptions = {}, now = new Date()) {
  const balance = options.balance;
  const status = balance ? statementBalanceStatus(state, balance, account, now) : 'invalid';
  // A confirmed statement sets the closing balance once; its debits are already
  // included in that amount. Savings rules are capped against the new balance.
  const balanceUpdated = !!balance && (status === 'new' || status === 'older');
  const withBalance: AccountImportState = balanceUpdated ? { ...state,
    reportedBalanceCents: balance!.amountCents, balanceAsOf: balance!.asOf, balanceSource: 'citizens-pdf', balanceUpdatedAt: now.toISOString(),
    statementBalanceKeys: [...(state.statementBalanceKeys ?? []), statementBalanceKey(balance!, account)],
  } : state;
  const result = applyBankImport(withBalance, candidates, applyRule, now);
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
      bankSource: rows[0].bankSource, bankAccountLabel: account.trim(), recurringHint: purchase.recurringHint || rows.some((row) => row.recurringHint) };
  });
  const movements = mergeAccountTransactions(state.accountTransactions, history, now);
  return { state: { ...withBalance, ...result.state, purchases, bankImportKeys: [...keys], accountTransactions: movements.transactions },
    imported: result.imported, skipped: result.skipped, savedCents: result.savedCents,
    matched: matched.size, balanceUpdated, transactionsAdded: movements.added, transactionsUpdated: movements.updated };
}
