import AsyncStorage from '@react-native-async-storage/async-storage';
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
export const useWidgetSettingsStore = create<WidgetSettings>()(persist(set => ({
  enabled: false, showAmounts: false, trackedPurchaseId: null,
  setTrackedPurchaseId: trackedPurchaseId => set({ trackedPurchaseId }),
  setEnabled: enabled => set({ enabled }), setShowAmounts: showAmounts => set({ showAmounts }),
}), { name: 'gasfinder-widget-settings', storage: createJSONStorage(() => AsyncStorage), version: 1 }));
