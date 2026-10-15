import { bankDuplicateCandidates, matchCandidates } from '@/features/pocket/reconciliation';
import type { BankDuplicateRevision, MatchRevision } from '@/features/pocket/reconciliation';
import { merchantAliasKey, validateDetails, revisionCanUndo } from '@/features/pocket/repository';
import type { TransactionDetails, TransactionRevision } from '@/features/pocket/repository';
import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AccountTransaction, TransactionDirections } from '@/features/pocket/transactions';
import { hideTransactionFromHistory, pocketTransactions, setTransactionDirection } from '@/features/pocket/transactions';
import { canReserve } from '@/features/pocket/logic';
import { applyAccountImport } from '@/features/bank/accountImport';
import type { AccountImportOptions } from '@/features/bank/accountImport';
import type { BankPurchase } from '@/features/bank/importLogic';
import { inferLinkedAccount, renameLinkedAccount, resolveLinkedAccount } from '@/features/bank/accountIdentity';
import type { BankAccountInput, LinkedBankAccount } from '@/features/bank/accountIdentity';
import { accountBalanceEstimate, balanceSnapshotIds } from '@/features/pocket/balanceEstimate';
import { DEFAULT_GOAL_SETTINGS, DEFAULT_SET_ASIDE_RULE, automaticSetAsideCents, canLogPurchase, canReleaseFromGoal, canReleaseUnassigned, canSetAsideForGoal, createGoalFromInput, editGoalFromInput } from '@/features/goals/logic';
import type { ArchivedGoal, Goal, GoalInput, GoalSettings, LoggedPurchase } from '@/features/goals/logic';

export type PocketEntry = {
  id: string;
  amountCents: number;
  createdAt: string;
  kind: 'reserve' | 'release' | 'assign';
  goalId?: string;
  purchaseId?: string;
};

type PocketState = {
  bankDuplicateHistory: BankDuplicateRevision[];
  markBankDuplicate: (id: string, canonicalId: string) => void;
  undoBankDuplicate: (id: string) => void;
  matchHistory: MatchRevision[];
  linkExistingPurchase: (bankId: string, purchaseId: string) => void;
  undoPurchaseLink: (id: string) => void;
  reportedBalanceCents: number | null;
  balanceUpdatedAt: string | null;
  balanceAsOf: string | null;
  balanceSource: 'manual' | 'citizens-pdf' | null;
  statementBalanceKeys: string[];
  linkedBankAccount: LinkedBankAccount | null;
  balanceIncludedTransactionIds: string[];
  renameBankAccount: (nickname: string) => void;
  reservedCents: number;
  entries: PocketEntry[];
  activeGoal: Goal | null;
  archivedGoals: ArchivedGoal[];
  purchases: LoggedPurchase[];
  accountTransactions: AccountTransaction[];
  hiddenTransactionIds: string[];
  transactionDirections: TransactionDirections;
  transactionDetails: Record<string, TransactionDetails>;
  merchantAliases: Record<string, string>;
  correctionHistory: TransactionRevision[];
  editTransactionDetails: (id: string, details: TransactionDetails, applyAlias: boolean) => void;
  undoCorrection: (id: string) => boolean;
  correctTransactionDirection: (id: string, direction: 'in' | 'out' | null) => void;
  removeTransactionFromHistory: (id: string) => string[];
  restoreTransactionsToHistory: (ids: string[]) => void;
  bankImportKeys: string[];
  bankImportAccountLabel: string;
  importBankPurchases: (purchases: BankPurchase[], applyRule: boolean, account: BankAccountInput, history?: AccountTransaction[], options?: AccountImportOptions) => { imported: number; skipped: number; savedCents: number; transactionsAdded: number; transactionsUpdated: number; matched: number; balanceUpdated: boolean };
  goalSettings: GoalSettings;
  setReportedBalance: (cents: number) => void;
  reserve: (cents: number) => boolean;
  release: (cents: number) => boolean;
  createGoal: (input: GoalInput, assignAll: boolean) => boolean;
  updateGoal: (input: GoalInput) => boolean;
  endGoal: () => boolean;
  deleteGoal: () => boolean;
  reserveForGoal: (cents: number, purchaseId?: string) => boolean;
  releaseFromGoal: (cents: number) => boolean;
  addPurchase: (id: string, title: string, amountCents: number, sourcePauseId?: string, source?: 'manual' | 'shortcut', occurredAt?: string, applyRule?: boolean) => boolean;
  updatePurchase: (id: string, title: string, amountCents: number) => boolean;
  skipPurchase: (id: string) => void;
  removePurchase: (id: string) => void;
  updateGoalSettings: (settings: Partial<GoalSettings>) => void;
};

function entry(kind: PocketEntry['kind'], amountCents: number, goalId?: string, purchaseId?: string): PocketEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amountCents, createdAt: new Date().toISOString(), kind, goalId, purchaseId };
}

export const usePocketStore = create<PocketState>()(
  persist(
    (rawSet, get) => { const set = guardedSet(rawSet); return ({
      bankDuplicateHistory: [],
      markBankDuplicate: (id, canonicalId) => set(state => {
        if (!bankDuplicateCandidates(state.accountTransactions,state.linkedBankAccount).some(pair => pair.row.id === id && pair.canonical.id === canonicalId)) throw Error('This pair changed. Review again.');
        return { accountTransactions:state.accountTransactions.map(row => row.id === id ? {...row,duplicateOf:canonicalId} : row),bankDuplicateHistory:[...state.bankDuplicateHistory,{id:`bank-match-${Date.now()}-${Math.random()}`,bankId:id,canonicalId,createdAt:new Date().toISOString()}] };
      }),
      undoBankDuplicate: id => set(state => {
        const revision = state.bankDuplicateHistory.find(item => item.id === id && !item.undoneAt);
        if (!revision || !state.accountTransactions.some(row => row.id === revision.bankId && row.duplicateOf === revision.canonicalId)) throw Error('This duplicate decision changed.');
        return {accountTransactions:state.accountTransactions.map(row => row.id === revision.bankId ? {...row,duplicateOf:undefined} : row),bankDuplicateHistory:state.bankDuplicateHistory.map(item => item.id === id ? {...item,undoneAt:new Date().toISOString()} : item)};
      }),
      matchHistory: [],
      linkExistingPurchase: (bankId, purchaseId) => set(state => {
        if (!matchCandidates(state.accountTransactions, state.purchases, state.linkedBankAccount).some(match => match.row.id === bankId && match.purchase.id === purchaseId)) throw Error('This match changed. Review again.');
        const previous = state.accountTransactions.find(row => row.id === bankId)!;
        return { accountTransactions: state.accountTransactions.map(row => row.id === bankId ? { ...row, linkedPurchaseId: purchaseId, shadowPurchaseIds:[...new Set([...(row.shadowPurchaseIds ?? []),...(row.linkedPurchaseId ? [row.linkedPurchaseId] : [])])] } : row), matchHistory: [...state.matchHistory, { id: `match-${Date.now()}-${Math.random()}`, bankId, purchaseId, previousLinkedPurchaseId:previous.linkedPurchaseId, previousShadowPurchaseIds:previous.shadowPurchaseIds, createdAt: new Date().toISOString() }] };
      }),
      undoPurchaseLink: id => set(state => {
        const revision = state.matchHistory.find(item => item.id === id && !item.undoneAt);
        if (!revision || !state.accountTransactions.some(row => row.id === revision.bankId && row.linkedPurchaseId === revision.purchaseId)) throw Error('This link has changed and cannot be undone here.');
        return { accountTransactions: state.accountTransactions.map(row => row.id === revision.bankId ? { ...row, linkedPurchaseId: revision.previousLinkedPurchaseId, shadowPurchaseIds:revision.previousShadowPurchaseIds } : row), matchHistory: state.matchHistory.map(item => item.id === id ? { ...item, undoneAt: new Date().toISOString() } : item) };
      }),
      reportedBalanceCents: null,
      balanceUpdatedAt: null,
      balanceAsOf: null,
      balanceSource: null,
      statementBalanceKeys: [],
      linkedBankAccount: null,
      balanceIncludedTransactionIds: [],
      renameBankAccount: (nickname) => set(state => renameLinkedAccount(state, resolveLinkedAccount(state, nickname))),
      reservedCents: 0,
      entries: [],
      activeGoal: null,
      archivedGoals: [],
      purchases: [],
      accountTransactions: [],
      hiddenTransactionIds: [],
      transactionDirections: {},
      transactionDetails: {}, merchantAliases: {}, correctionHistory: [],
      editTransactionDetails: (id, input, applyAlias) => set(state => {
        const row = pocketTransactions(state.accountTransactions, state.purchases, state.entries).find(row => row.id === id);
        if (!row) throw new Error('This transaction could not be found.');
        const details = validateDetails(input), key = merchantAliasKey(row);
        const before: TransactionRevision['before'] = { details: state.transactionDetails[id] ?? null, ...(applyAlias ? { alias: { key, value: state.merchantAliases[key] ?? null } } : {}) };
        const after: TransactionRevision['after'] = { details, ...(applyAlias ? { alias: { key, value: details.merchant || null } } : {}) };
        const aliases = { ...state.merchantAliases }; if (applyAlias) { if (details.merchant) aliases[key] = details.merchant; else delete aliases[key]; }
        return { transactionDetails: { ...state.transactionDetails, [id]: details }, merchantAliases: aliases,
          correctionHistory: [...state.correctionHistory, { id: `edit-${Date.now()}-${Math.random().toString(36).slice(2)}`, transactionId: id, createdAt: new Date().toISOString(), before, after }] };
      }),
      undoCorrection: id => {
        const state = get(), revision = state.correctionHistory.find(item => item.id === id);
        if (!revision || !revisionCanUndo(revision, state)) return false;
        const details = { ...state.transactionDetails }, aliases = { ...state.merchantAliases };
        if ('details' in revision.before) { if (revision.before.details) details[revision.transactionId] = revision.before.details; else delete details[revision.transactionId]; }
        if (revision.before.alias) { if (revision.before.alias.value !== null) aliases[revision.before.alias.key] = revision.before.alias.value; else delete aliases[revision.before.alias.key]; }
        set({ transactionDetails: details, merchantAliases: aliases,
          transactionDirections: 'direction' in revision.before ? setTransactionDirection(pocketTransactions(state.accountTransactions, state.purchases, state.entries), state.transactionDirections, revision.transactionId, revision.before.direction ?? null) : state.transactionDirections,
          correctionHistory: state.correctionHistory.map(item => item.id === id ? { ...item, undoneAt: new Date().toISOString() } : item) }); return true;
      },
      correctTransactionDirection: (id, direction) => set(state => {
        const directions = setTransactionDirection(pocketTransactions(state.accountTransactions, state.purchases, state.entries), state.transactionDirections, id, direction);
        if (directions === state.transactionDirections) return state;
        return { transactionDirections: directions, correctionHistory: [...state.correctionHistory, { id: `direction-${Date.now()}-${Math.random().toString(36).slice(2)}`, transactionId: id, createdAt: new Date().toISOString(), before: { direction: state.transactionDirections[id] ?? null }, after: { direction } }] };
      }),
      removeTransactionFromHistory: (id) => {
        const state = get();
        const result = hideTransactionFromHistory(pocketTransactions(state.accountTransactions, state.purchases, state.entries), state.hiddenTransactionIds, id);
        if (result.removedIds.length) set({ hiddenTransactionIds: result.hiddenIds });
        return result.removedIds;
      },
      restoreTransactionsToHistory: (ids) => {
        const restored = new Set(ids);
        set((state) => ({ hiddenTransactionIds: state.hiddenTransactionIds.filter((id) => !restored.has(id)) }));
      },
      bankImportKeys: [],
      bankImportAccountLabel: 'Main account',
      importBankPurchases: (purchases, applyRule, account, history = [], options = {}) => {
        const profile = resolveLinkedAccount(get(), typeof account === 'string' ? account : account.nickname, options.statementIdentifier ?? (typeof account === 'string' ? null : account.statementIdentifier));
        const { state, ...result } = applyAccountImport(get(), purchases, applyRule, profile, history, options);
        set({ ...state, bankImportAccountLabel: profile.nickname });
        return result;
      },
      goalSettings: DEFAULT_GOAL_SETTINGS,
      setReportedBalance: (cents) => {
        if (Number.isSafeInteger(cents) && cents >= 0) {
          const now = new Date();
          const state = get();
          set({ reportedBalanceCents: cents, balanceUpdatedAt: now.toISOString(), balanceSource: 'manual', balanceAsOf: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
            balanceIncludedTransactionIds: balanceSnapshotIds(state) });
        }
      },
      reserve: (cents) => {
        const state = get();
        if (!canReserve(cents, accountBalanceEstimate(state).estimatedCents, state.reservedCents)) return false;
        set({ reservedCents: state.reservedCents + cents, entries: [entry('reserve', cents), ...state.entries] });
        return true;
      },
      release: (cents) => {
        const state = get();
        if (!canReleaseUnassigned(cents, state.reservedCents, state.activeGoal)) return false;
        set({ reservedCents: state.reservedCents - cents, entries: [entry('release', cents), ...state.entries] });
        return true;
      },
      createGoal: (input, assignAll) => {
        const state = get();
        if (state.activeGoal) return false;
        const goal = createGoalFromInput(input, state.reservedCents, assignAll, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        if (!goal) return false;
        set({ activeGoal: goal, entries: assignAll && state.reservedCents > 0
          ? [entry('assign', state.reservedCents, goal.id), ...state.entries]
          : state.entries });
        return true;
      },
      updateGoal: (input) => {
        const goal = get().activeGoal;
        const edited = goal ? editGoalFromInput(goal, input) : null;
        if (!edited) return false;
        set({ activeGoal: edited });
        return true;
      },
      endGoal: () => {
        const state = get();
        if (!state.activeGoal) return false;
        const goal = state.activeGoal;
        set({ activeGoal: null, archivedGoals: [{ ...goal, endedAt: new Date().toISOString(), result: goal.savedCents >= goal.targetCents ? 'reached' : 'stopped' }, ...state.archivedGoals] });
        return true;
      },
      deleteGoal: () => {
        if (!get().activeGoal) return false;
        set({ activeGoal: null });
        return true;
      },
      reserveForGoal: (cents, purchaseId) => {
        const state = get();
        const goal = state.activeGoal;
        if (!goal || !canSetAsideForGoal(cents, goal, accountBalanceEstimate(state).estimatedCents, state.reservedCents)) return false;
        const purchase = purchaseId ? state.purchases.find((item) => item.id === purchaseId) : undefined;
        if (purchaseId && (!purchase || purchase.decision !== 'pending')) return false;
        set({
          reservedCents: state.reservedCents + cents,
          activeGoal: { ...goal, savedCents: goal.savedCents + cents },
          entries: [entry('reserve', cents, goal.id, purchaseId), ...state.entries],
          purchases: purchaseId ? state.purchases.map((item) => item.id === purchaseId ? { ...item, decision: 'saved' as const, savedCents: cents } : item) : state.purchases,
        });
        return true;
      },
      releaseFromGoal: (cents) => {
        const state = get();
        const goal = state.activeGoal;
        if (!goal || !canReleaseFromGoal(cents, goal)) return false;
        set({ reservedCents: state.reservedCents - cents, activeGoal: { ...goal, savedCents: goal.savedCents - cents }, entries: [entry('release', cents, goal.id), ...state.entries] });
        return true;
      },
      addPurchase: (id, title, amountCents, sourcePauseId, source = 'manual', occurredAt, applyRule = true) => {
        const state = get();
        if (!canLogPurchase(id, title, amountCents, sourcePauseId, state.purchases)) return false;
        const goal = state.activeGoal;
        const purchasedAt = occurredAt ?? new Date().toISOString();
        if (!Number.isFinite(Date.parse(purchasedAt)) || Date.parse(purchasedAt) > Date.now() + 5 * 60_000) return false;
        const purchase: LoggedPurchase = { id, title: title.trim(), amountCents, purchasedAt, sourcePauseId, source, decision: 'pending',
          ...(state.linkedBankAccount ? { bankAccountId: state.linkedBankAccount.id, bankAccountLabel: state.linkedBankAccount.nickname } : {}) };
        const afterPurchase = accountBalanceEstimate({ ...state, purchases: [purchase, ...state.purchases] }).estimatedCents;
        const savedCents = applyRule ? automaticSetAsideCents(amountCents, goal, afterPurchase, state.reservedCents) : 0;
        purchase.decision = savedCents > 0 ? 'saved' : 'pending';
        if (savedCents > 0) purchase.savedCents = savedCents;
        set({
          purchases: [purchase, ...state.purchases],
          ...(goal && savedCents > 0 ? {
            reservedCents: state.reservedCents + savedCents,
            activeGoal: { ...goal, savedCents: goal.savedCents + savedCents },
            entries: [entry('reserve', savedCents, goal.id, id), ...state.entries],
          } : {}),
        });
        return true;
      },
      updatePurchase: (id, title, amountCents) => {
        const state = get();
        if (!state.purchases.some((item) => item.id === id) || !title.trim() || title.trim().length > 80 || !Number.isSafeInteger(amountCents) || amountCents <= 0) return false;
        set({ purchases: state.purchases.map((item) => item.id === id ? { ...item, title: title.trim(), amountCents } : item) });
        return true;
      },
      skipPurchase: (id) => set((state) => ({ purchases: state.purchases.map((item) => item.id === id && item.decision === 'pending' ? { ...item, decision: 'skipped' } : item) })),
      removePurchase: (id) => set((state) => ({ purchases: state.purchases.filter((item) => item.id !== id) })),
      updateGoalSettings: (settings) => set((state) => ({ goalSettings: {
        suggestionsEnabled: settings.suggestionsEnabled ?? state.goalSettings.suggestionsEnabled,
        maxSuggestionCents: Number.isSafeInteger(settings.maxSuggestionCents) && (settings.maxSuggestionCents ?? 0) >= 0 ? settings.maxSuggestionCents! : state.goalSettings.maxSuggestionCents,
        maxPurchasePercent: Number.isFinite(settings.maxPurchasePercent) && (settings.maxPurchasePercent ?? -1) >= 0 && (settings.maxPurchasePercent ?? 101) <= 100 ? settings.maxPurchasePercent! : state.goalSettings.maxPurchasePercent,
        widgetEnabled: settings.widgetEnabled ?? state.goalSettings.widgetEnabled,
        widgetShowAmounts: settings.widgetShowAmounts ?? state.goalSettings.widgetShowAmounts,
      } })),
    }); },
    {
      name: 'gasfinder-savings-pocket', storage: createJSONStorage(() => appStorage), version: 13,
      migrate: (persisted, version) => {
        const previous = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<PocketState>;
        if (version < 2) return { ...previous, activeGoal: null, archivedGoals: [], purchases: [], accountTransactions: [], bankImportKeys: [], bankImportAccountLabel: 'Main account', goalSettings: DEFAULT_GOAL_SETTINGS };
        return {
          ...previous,
          linkedBankAccount: inferLinkedAccount({ ...previous, accountTransactions: previous.accountTransactions ?? [], purchases: previous.purchases ?? [] }),
          balanceIncludedTransactionIds: previous.balanceIncludedTransactionIds ?? [],
          balanceAsOf: previous.balanceAsOf ?? null,
          balanceSource: previous.balanceSource ?? null,
          statementBalanceKeys: previous.statementBalanceKeys ?? [],
          bankDuplicateHistory: previous.bankDuplicateHistory ?? [],
          matchHistory: previous.matchHistory ?? [],
          bankImportKeys: previous.bankImportKeys ?? [],
          accountTransactions: previous.accountTransactions ?? [],
          hiddenTransactionIds: previous.hiddenTransactionIds ?? [],
          transactionDirections: previous.transactionDirections ?? {},
          bankImportAccountLabel: previous.bankImportAccountLabel ?? 'Main account',
          activeGoal: previous.activeGoal ? { ...previous.activeGoal, setAsideRule: previous.activeGoal.setAsideRule ?? DEFAULT_SET_ASIDE_RULE } : null,
          archivedGoals: (previous.archivedGoals ?? []).map((goal) => ({ ...goal, setAsideRule: goal.setAsideRule ?? DEFAULT_SET_ASIDE_RULE })),
          goalSettings: { ...DEFAULT_GOAL_SETTINGS, ...previous.goalSettings },
        };
      },
    },
  ),
);
