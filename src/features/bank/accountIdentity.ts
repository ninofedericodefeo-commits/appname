import type { LoggedPurchase } from '../goals/logic.ts';
import type { AccountTransaction } from '../pocket/transactions.ts';

export type LinkedBankAccount = { id: string; nickname: string; importNamespace: string; aliases: string[]; statementIdentifier: string | null };
export type BankAccountInput = string | LinkedBankAccount;
const normalized = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
export const accountNickname = (account: BankAccountInput) => typeof account === 'string' ? account.trim() : account.nickname;
export const accountNamespace = (account: BankAccountInput) => typeof account === 'string' ? normalized(account) : account.importNamespace;
export function accountContains(account: LinkedBankAccount, label: string, id?: string) {
  return id ? id === account.id : account.aliases.some(alias => normalized(alias) === normalized(label));
}

const partialIdentifier = (id: string) => id.startsWith('ending-') || /[*x]/i.test(id);
export function sameStatementAccount(a: string, b: string) {
  if (a === b) return true;
  const ending = (id: string) => id.replace(/\D/g, '').slice(-4);
  // A masked/full variant may match; two different full numbers never do.
  return (partialIdentifier(a) || partialIdentifier(b)) && ending(a).length === 4 && ending(a) === ending(b);
}
export function strongestStatementIdentifier(saved: string | null, incoming: string | null) {
  return saved && !partialIdentifier(saved) ? saved : incoming ?? saved;
}

type LegacyAccountState = { linkedBankAccount?: LinkedBankAccount | null; bankImportAccountLabel?: string;
  accountTransactions: AccountTransaction[]; purchases: LoggedPurchase[]; statementBalanceKeys?: string[];
  reportedBalanceCents?: number | null; balanceAsOf?: string | null; balanceSource?: string | null };

export function inferLinkedAccount(state: LegacyAccountState): LinkedBankAccount | null {
  if (state.linkedBankAccount) return state.linkedBankAccount;
  const names = [...new Set([...state.accountTransactions.map(row => row.accountLabel), ...state.purchases.map(row => row.bankAccountLabel ?? '')].filter(Boolean))];
  let original = names.find(name => normalized(name) === normalized(state.bankImportAccountLabel ?? ''));
  for (const key of [...(state.statementBalanceKeys ?? [])].reverse()) {
    try {
      const [name, date, cents] = JSON.parse(key);
      if (typeof name === 'string' && state.balanceSource === 'citizens-pdf' && date === state.balanceAsOf && cents === state.reportedBalanceCents) {
        original = names.find(label => normalized(label) === normalized(name)) ?? (normalized(state.bankImportAccountLabel ?? '') === normalized(name) ? state.bankImportAccountLabel : name); break;
      }
    } catch { /* Legacy keys cannot define an account unless valid. */ }
  }
  if (!original && names.length === 1) original = names[0];
  if (!original) return null;
  return newLinkedAccount(original);
}

function newLinkedAccount(name: string): LinkedBankAccount {
  const importNamespace = normalized(name);
  let hash = 2166136261;
  for (const character of importNamespace) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  // Preserve the original import namespace so old IDs and hidden rows remain valid.
  return { id: `account-${(hash >>> 0).toString(16)}`, nickname: name.trim(), importNamespace, aliases: [name.trim()], statementIdentifier: null };
}

export function resolveLinkedAccount(state: LegacyAccountState, nickname: string, identifier: string | null = null): LinkedBankAccount {
  const name = nickname.trim();
  if (!name || name.length > 60) throw Error('Enter an account name up to 60 characters.');
  const account = inferLinkedAccount(state) ?? newLinkedAccount(name);
  if (identifier && account.statementIdentifier && !sameStatementAccount(identifier, account.statementIdentifier)) {
    throw Error('This statement belongs to a different bank account. Choose a statement for your linked account. Separate account balances are not supported yet.');
  }
  return { ...account, nickname: name, aliases: [...new Set([...account.aliases, name])],
    statementIdentifier: strongestStatementIdentifier(account.statementIdentifier, identifier) };
}

export function renameLinkedAccount(state: LegacyAccountState, account: LinkedBankAccount) {
  return { linkedBankAccount: account, bankImportAccountLabel: account.nickname,
    purchases: state.purchases.map(row => accountContains(account, row.bankAccountLabel ?? '', row.bankAccountId) ? { ...row, bankAccountLabel: account.nickname, bankAccountId: account.id } : row),
    accountTransactions: state.accountTransactions.map(row => accountContains(account, row.accountLabel, row.accountId) ? { ...row, accountLabel: account.nickname, accountId: account.id } : row) };
}
