import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ShortcutSetupStage } from '@/features/goals/shortcutSetup';

type ShortcutSetupState = {
  // These are guide steps, never a claim that iOS installed/enabled anything.
  stage: ShortcutSetupStage;
  verificationStartedAt: string | null;
  connectCard: () => void;
  awaitPurchase: () => void;
  restart: () => void;
};

export const useShortcutSetupStore = create<ShortcutSetupState>()(persist((set) => ({
  stage: 'install',
  verificationStartedAt: null,
  connectCard: () => set({ stage: 'automation', verificationStartedAt: null }),
  awaitPurchase: () => set({ stage: 'verify', verificationStartedAt: new Date().toISOString() }),
  restart: () => set({ stage: 'install', verificationStartedAt: null }),
}), {
  name: 'gasfinder-shortcut-setup-v1',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ stage, verificationStartedAt }) => ({ stage, verificationStartedAt }),
}));
