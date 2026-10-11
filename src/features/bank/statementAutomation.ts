import { statementBalanceStatus } from './accountImport.ts';
import type { AccountImportState, StatementBalance } from './accountImport.ts';
import type { CitizensStatement } from './citizensStatement.ts';
import { guessMapping, previewAccountTransactions, previewBankCSV } from './importLogic.ts';
import type { BankPreviewRow } from './importLogic.ts';
import { linkAccountTransactions } from '../pocket/transactions.ts';
import type { AccountTransaction } from '../pocket/transactions.ts';

export const STATEMENT_SHORTCUT_NAME = 'GasFinder Import Statement';
export const statementShortcutURL = `shortcuts://open-shortcut?name=${encodeURIComponent(STATEMENT_SHORTCUT_NAME)}`;

export type StatementAutomationSettings = { enabled: boolean; accountLabel: string; confirmedAccountIdentifier: string | null };
export type AutomaticStatementPlan = {
  status: 'ready'; accountLabel: string; purchases: BankPreviewRow[]; history: AccountTransaction[];
  balance: StatementBalance; transactionCount: number; purchaseCount: number;
};
type Review = { status: 'review'; reason: string };

export function prepareAutomaticStatement(settings: StatementAutomationSettings, sharedPDF: boolean, statement: CitizensStatement,
  state: AccountImportState, now = new Date()): AutomaticStatementPlan | Review {
  const review = (reason: string): Review => ({ status: 'review', reason });
  if (!settings.enabled || !sharedPDF) return review('Review and save this statement.');
  if (!settings.accountLabel.trim()) return review('Choose an account nickname in Quick statement import first.');
  if (!statement.accountIdentifier) return review('The account number could not be identified. Confirm this statement manually.');
  if (!settings.confirmedAccountIdentifier) return review('Review your first statement once to confirm the account. Future matching PDFs can import automatically.');
  if (settings.confirmedAccountIdentifier !== statement.accountIdentifier) return review('This PDF is for a different account. Review it and choose the correct account nickname.');
  if (statement.warnings.length) return review('This PDF has reading warnings. Check them against your statement before saving.');
  if (!statement.balance) return review('A clear closing balance is needed for automatic import. Review this PDF.');
  const balanceStatus = statementBalanceStatus(state, statement.balance, settings.accountLabel, now);
  if (balanceStatus === 'invalid') return review('The closing balance or date needs review.');
  if (balanceStatus === 'older') return review('This statement closes before your saved balance. Review it before replacing that balance.');
  const mapping = guessMapping(statement.csv);
  const purchases = previewBankCSV(statement.csv, mapping, settings.accountLabel, state.purchases, state.bankImportKeys, now);
  const transactions = previewAccountTransactions(statement.csv, mapping, settings.accountLabel, now);
  if (!transactions.rows.length || transactions.excluded.length) return review('Some transactions could not be imported. Check this statement before saving.');
  if (purchases.rows.some((row) => row.duplicate === 'possible')) return review('Some charges may match purchases already logged in the app. Review the matches before saving.');
  const selected = purchases.rows.filter((row) => row.duplicate !== 'known');
  return { status: 'ready', accountLabel: settings.accountLabel.trim(), purchases: selected,
    history: linkAccountTransactions(transactions.rows, purchases.rows, new Set(selected.map((row) => row.id))),
    balance: statement.balance, transactionCount: transactions.rows.length, purchaseCount: purchases.rows.length };
}

// Re-check the live account/settings after file storage: a Wallet purchase or a
// newer balance can arrive while the archive is being written. No retry loop.
export async function importSharedStatement<Result>(options: {
  prepare: () => AutomaticStatementPlan | Review;
  archive: (plan: AutomaticStatementPlan) => Promise<unknown>;
  isCurrent: () => boolean;
  commit: (plan: AutomaticStatementPlan) => Result;
}): Promise<Review | { status: 'canceled' } | { status: 'saved'; result: Result }> {
  if (!options.isCurrent()) return { status: 'canceled' };
  const first = options.prepare();
  if (first.status === 'review') return first;
  await options.archive(first);
  if (!options.isCurrent()) return { status: 'canceled' };
  const current = options.prepare();
  if (current.status === 'review') return current;
  return { status: 'saved', result: options.commit(current) };
}
