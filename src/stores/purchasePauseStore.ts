import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PurchasePauseItem } from '@/types/investing';

export type PurchasePauseDelayHours = 24 | 48 | 168;

type PurchasePauseState = {
  enabled: boolean;
  delayHours: PurchasePauseDelayHours;
  items: PurchasePauseItem[];
  setEnabled: (enabled: boolean) => void;
  setDelayHours: (hours: PurchasePauseDelayHours) => void;
  addPurchase: (name: string, amount: number) => void;
  recordOutcome: (id: string, outcome: 'bought' | 'skipped') => void;
  removePurchase: (id: string) => void;
};

export const usePurchasePauseStore = create<PurchasePauseState>()(
  persist(
    (set) => ({
      enabled: false,
      delayHours: 24,
      items: [],
      setEnabled: (enabled) => set({ enabled }),
      setDelayHours: (delayHours) => set({ delayHours }),
      addPurchase: (name, amount) =>
        set((state) => {
          const createdAt = Date.now();
          const item: PurchasePauseItem = {
            id: `${createdAt}-${Math.random()}`,
            name: name.trim(),
            amount: Math.round(amount * 100) / 100,
            createdAt,
            reviewAt: createdAt + state.delayHours * 60 * 60 * 1000,
            status: 'waiting',
          };

          return { items: [item, ...state.items] };
        }),
      recordOutcome: (id, status) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.status === 'waiting'
              ? { ...item, status, outcomeAt: Date.now() }
              : item,
          ),
        })),
      removePurchase: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    }),
    {
      name: 'gasfinder-purchase-pause-demo',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
