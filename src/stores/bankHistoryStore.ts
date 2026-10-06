import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BankTransaction } from '@/features/bankHistory/logic';

const MAX_SAVED_TRANSACTIONS = 50_000;

type BankHistoryState = {
  transactions: BankTransaction[];
  lastImportedAt: string | null;
  isSampleData: boolean;
  dismissedRecurringKeys: string[];
  importTransactions: (transactions: BankTransaction[]) => number;
  loadSampleTransactions: (transactions: BankTransaction[]) => number;
  dismissRecurringCharge: (key: string) => void;
  restoreRecurringCharge: (key: string) => void;
  removeTransaction: (id: string) => void;
  clearHistory: () => void;
};

export const useBankHistoryStore = create<BankHistoryState>()(
  persist(
    (set, get) => ({
      transactions: [],
      lastImportedAt: null,
      isSampleData: false,
      dismissedRecurringKeys: [],
      importTransactions: (incoming) => {
        const current = get();
        const existing = current.isSampleData ? [] : current.transactions;
        const existingIds = new Set(existing.map((transaction) => transaction.id));
        const seenIds = new Set(existingIds);
        const newTransactions = incoming.filter((transaction) => {
          if (seenIds.has(transaction.id)) return false;
          seenIds.add(transaction.id);
          return true;
        });
        const transactions = [...newTransactions, ...existing]
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, MAX_SAVED_TRANSACTIONS);
        set({ transactions, lastImportedAt: new Date().toISOString(), isSampleData: false });
        return transactions.reduce((count, transaction) => count + Number(!existingIds.has(transaction.id)), 0);
      },
      loadSampleTransactions: (sample) => {
        if (get().transactions.length > 0) return 0;
        const transactions = [...sample].sort((left, right) => right.date.localeCompare(left.date));
        set({ transactions, lastImportedAt: new Date().toISOString(), isSampleData: true });
        return transactions.length;
      },
      dismissRecurringCharge: (key) => set((state) => ({
        dismissedRecurringKeys: state.dismissedRecurringKeys.includes(key)
          ? state.dismissedRecurringKeys
          : [...state.dismissedRecurringKeys, key],
      })),
      restoreRecurringCharge: (key) => set((state) => ({
        dismissedRecurringKeys: state.dismissedRecurringKeys.filter((dismissedKey) => dismissedKey !== key),
      })),
      removeTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter((transaction) => transaction.id !== id),
      })),
      clearHistory: () => set({ transactions: [], lastImportedAt: null, isSampleData: false, dismissedRecurringKeys: [] }),
    }),
    {
      name: 'gasfinder-bank-history',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
