import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StatementAutomationSettings } from '@/features/bank/statementAutomation';

type Receipt = { name: string; importedAt: string; balanceAsOf: string; automatic: boolean };
type State = StatementAutomationSettings & {
  lastImport: Receipt | null;
  configure: (enabled: boolean, accountLabel: string) => void;
  confirmImport: (accountLabel: string, accountIdentifier: string | null, receipt: Receipt) => void;
};
export const useStatementAutomationStore = create<State>()(persist((set, get) => ({
  enabled: false, accountLabel: '', confirmedAccountIdentifier: null, lastImport: null,
  configure: (enabled, accountLabel) => {
    const sameAccount = get().accountLabel.toLowerCase() === accountLabel.trim().toLowerCase();
    set({ enabled, accountLabel: accountLabel.trim(), ...(sameAccount ? {} : { confirmedAccountIdentifier: null, lastImport: null }) });
  },
  confirmImport: (accountLabel, accountIdentifier, receipt) => {
    const state = get();
    if (!state.enabled || !accountIdentifier || state.accountLabel.toLowerCase() !== accountLabel.trim().toLowerCase() ||
      (state.confirmedAccountIdentifier && state.confirmedAccountIdentifier !== accountIdentifier)) return;
    set({ confirmedAccountIdentifier: accountIdentifier, lastImport: receipt });
  },
}), {
  name: 'gasfinder-statement-automation-v1', storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ enabled, accountLabel, confirmedAccountIdentifier, lastImport }) => ({ enabled, accountLabel, confirmedAccountIdentifier, lastImport }),
}));
