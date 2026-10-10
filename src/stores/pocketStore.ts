import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { canReserve } from '@/features/pocket/logic';
import { applyBankImport } from '@/features/bank/importLogic';
import type { BankPurchase } from '@/features/bank/importLogic';
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
  reportedBalanceCents: number | null;
  balanceUpdatedAt: string | null;
  reservedCents: number;
  entries: PocketEntry[];
  activeGoal: Goal | null;
  archivedGoals: ArchivedGoal[];
  purchases: LoggedPurchase[];
  bankImportKeys: string[];
  bankImportAccountLabel: string;
  importBankPurchases: (purchases: BankPurchase[], applyRule: boolean, accountLabel: string) => { imported: number; skipped: number; savedCents: number };
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
  addPurchase: (id: string, title: string, amountCents: number, sourcePauseId?: string, source?: 'manual' | 'shortcut') => boolean;
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
    (set, get) => ({
      reportedBalanceCents: null,
      balanceUpdatedAt: null,
      reservedCents: 0,
      entries: [],
      activeGoal: null,
      archivedGoals: [],
      purchases: [],
      bankImportKeys: [],
      bankImportAccountLabel: 'Main account',
      importBankPurchases: (purchases, applyRule, accountLabel) => {
        const result = applyBankImport(get(), purchases, applyRule);
        if (result.imported > 0) set({ ...result.state, bankImportAccountLabel: accountLabel.trim() });
        return { imported: result.imported, skipped: result.skipped, savedCents: result.savedCents };
      },
      goalSettings: DEFAULT_GOAL_SETTINGS,
      setReportedBalance: (cents) => {
        if (Number.isSafeInteger(cents) && cents >= 0) set({ reportedBalanceCents: cents, balanceUpdatedAt: new Date().toISOString() });
      },
      reserve: (cents) => {
        const state = get();
        if (!canReserve(cents, state.reportedBalanceCents, state.reservedCents)) return false;
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
        if (!goal || !canSetAsideForGoal(cents, goal, state.reportedBalanceCents, state.reservedCents)) return false;
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
      addPurchase: (id, title, amountCents, sourcePauseId, source = 'manual') => {
        const state = get();
        if (!canLogPurchase(id, title, amountCents, sourcePauseId, state.purchases)) return false;
        const goal = state.activeGoal;
        const savedCents = automaticSetAsideCents(amountCents, goal, state.reportedBalanceCents, state.reservedCents);
        const purchasedAt = new Date().toISOString();
        const purchase: LoggedPurchase = { id, title: title.trim(), amountCents, purchasedAt, sourcePauseId, source,
          decision: savedCents > 0 ? 'saved' : 'pending', ...(savedCents > 0 ? { savedCents } : {}) };
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
    }),
    {
      name: 'gasfinder-savings-pocket', storage: createJSONStorage(() => AsyncStorage), version: 4,
      migrate: (persisted, version) => {
        const previous = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<PocketState>;
        if (version < 2) return { ...previous, activeGoal: null, archivedGoals: [], purchases: [], bankImportKeys: [], bankImportAccountLabel: 'Main account', goalSettings: DEFAULT_GOAL_SETTINGS };
        return {
          ...previous,
          bankImportKeys: previous.bankImportKeys ?? [],
          bankImportAccountLabel: previous.bankImportAccountLabel ?? 'Main account',
          activeGoal: previous.activeGoal ? { ...previous.activeGoal, setAsideRule: previous.activeGoal.setAsideRule ?? DEFAULT_SET_ASIDE_RULE } : null,
          archivedGoals: (previous.archivedGoals ?? []).map((goal) => ({ ...goal, setAsideRule: goal.setAsideRule ?? DEFAULT_SET_ASIDE_RULE })),
          goalSettings: { ...DEFAULT_GOAL_SETTINGS, ...previous.goalSettings },
        };
      },
    },
  ),
);
