import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StatementAutomationSettings } from '@/features/bank/statementAutomation';
import { sameStatementAccount, strongestStatementIdentifier } from '@/features/bank/accountIdentity';

type Receipt = { name: string; importedAt: string; balanceAsOf: string; automatic: boolean };
type State = StatementAutomationSettings & {
  lastImport: Receipt | null;
  configure: (enabled: boolean, accountLabel: string) => void;
  confirmImport: (accountLabel: string, accountIdentifier: string | null, receipt: Receipt) => void;
};
export const useStatementAutomationStore = create<State>()(persist((rawSet, get) => { const set = guardedSet(rawSet); return ({
  enabled: false, accountLabel: '', confirmedAccountIdentifier: null, lastImport: null,
  configure: (enabled, accountLabel) => {
    // The app tracks one bank account. Its display name is not its identity.
    set({ enabled, accountLabel: accountLabel.trim() });
  },
  confirmImport: (accountLabel, accountIdentifier, receipt) => {
    const state = get();
    if (!state.enabled || !accountIdentifier || state.accountLabel.toLowerCase() !== accountLabel.trim().toLowerCase() ||
      (state.confirmedAccountIdentifier && !sameStatementAccount(state.confirmedAccountIdentifier, accountIdentifier))) return;
    set({ confirmedAccountIdentifier: strongestStatementIdentifier(state.confirmedAccountIdentifier, accountIdentifier), lastImport: receipt });
  },
}); }, {
  name: 'gasfinder-statement-automation-v1', storage: createJSONStorage(() => appStorage),
  partialize: ({ enabled, accountLabel, confirmedAccountIdentifier, lastImport }) => ({ enabled, accountLabel, confirmedAccountIdentifier, lastImport }),
}));
