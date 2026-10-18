import { mergePersistedState } from '@/lib/persistedState';
import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ShortcutSetupStage } from '@/features/goals/shortcutSetup';

type ShortcutSetupState = {
  captureLog: { id: string; at: string; outcome: 'received' | 'repeated' | 'invalid' | 'failed' }[];
  recordCapture: (outcome: 'received' | 'repeated' | 'invalid' | 'failed') => void;
  // These are guide steps, never a claim that iOS installed/enabled anything.
  stage: ShortcutSetupStage;
  verificationStartedAt: string | null;
  connectCard: () => void;
  awaitPurchase: () => void;
  restart: () => void;
};

export const useShortcutSetupStore = create<ShortcutSetupState>()(persist((rawSet) => { const set = guardedSet(rawSet); return ({
  captureLog: [],
  recordCapture: outcome => set(state => ({ captureLog: [{ id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), outcome }, ...state.captureLog].slice(0,30) })),
  stage: 'install',
  verificationStartedAt: null,
  connectCard: () => set({ stage: 'automation', verificationStartedAt: null }),
  awaitPurchase: () => set({ stage: 'verify', verificationStartedAt: new Date().toISOString() }),
  restart: () => set({ stage: 'install', verificationStartedAt: null }),
}); }, {
  name: 'gasfinder-shortcut-setup-v1',
  storage: createJSONStorage(() => appStorage), merge: mergePersistedState,
  version: 1, migrate: state => ({ captureLog: [], ...(state as object) }),
  partialize: ({ stage, verificationStartedAt, captureLog }) => ({ stage, verificationStartedAt, captureLog }),
}));
