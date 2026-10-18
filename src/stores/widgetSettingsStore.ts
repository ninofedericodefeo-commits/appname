import { mergePersistedState } from '@/lib/persistedState';
import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type WidgetSettings = {
  enabled: boolean;
  showAmounts: boolean;
  trackedPurchaseId: string | null;
  setTrackedPurchaseId: (id: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setShowAmounts: (showAmounts: boolean) => void;
};
export const useWidgetSettingsStore = create<WidgetSettings>()(persist(rawSet => { const set = guardedSet(rawSet); return ({
  enabled: false, showAmounts: false, trackedPurchaseId: null,
  setTrackedPurchaseId: trackedPurchaseId => set({ trackedPurchaseId }),
  setEnabled: enabled => set({ enabled }), setShowAmounts: showAmounts => set({ showAmounts }),
}); }, { name: 'gasfinder-widget-settings', storage: createJSONStorage(() => appStorage), merge: mergePersistedState, version: 1 }));
