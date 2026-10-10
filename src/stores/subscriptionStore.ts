import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { bankMerchant } from '@/features/subscriptions/bankSuggestions';
import type { Subscription } from '@/features/subscriptions/logic';

type SubscriptionInput = Pick<Subscription, 'name' | 'amountCents' | 'cadence' | 'day' | 'month' | 'bankMerchantKey'>;

type SubscriptionState = {
  subscriptions: Subscription[];
  remindersEnabled: boolean;
  dismissedBankSuggestions: string[];
  dismissBankSuggestion: (key: string) => void;
  restoreBankSuggestions: () => void;
  setRemindersEnabled: (enabled: boolean) => void;
  saveSubscription: (input: SubscriptionInput, id?: string) => void;
  setActive: (id: string, active: boolean) => void;
  review: (id: string, renewalDate: string, decision: 'keep' | 'plan-to-cancel') => void;
  removeSubscription: (id: string) => void;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      subscriptions: [],
      remindersEnabled: false,
      dismissedBankSuggestions: [],
      dismissBankSuggestion: (key) => set((state) => ({ dismissedBankSuggestions: [...new Set([...state.dismissedBankSuggestions, key])] })),
      restoreBankSuggestions: () => set({ dismissedBankSuggestions: [] }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      saveSubscription: (input, id) => set((state) => {
        if (id) {
          return {
            subscriptions: state.subscriptions.map((subscription) =>
              subscription.id === id ? { ...subscription, ...input, lastReview: undefined } : subscription,
            ),
          };
        }
        if (input.bankMerchantKey && state.subscriptions.some((subscription) => subscription.bankMerchantKey === input.bankMerchantKey || bankMerchant(subscription.name).key === input.bankMerchantKey)) return state;
        const subscription: Subscription = {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          active: true,
        };
        return { subscriptions: [subscription, ...state.subscriptions] };
      }),
      setActive: (id, active) => set((state) => ({
        subscriptions: state.subscriptions.map((subscription) =>
          subscription.id === id ? { ...subscription, active } : subscription,
        ),
      })),
      review: (id, renewalDate, decision) => set((state) => ({
        subscriptions: state.subscriptions.map((subscription) =>
          subscription.id === id
            ? { ...subscription, lastReview: { renewalDate, decision, decidedAt: new Date().toISOString() } }
            : subscription,
        ),
      })),
      removeSubscription: (id) => set((state) => ({
        subscriptions: state.subscriptions.filter((subscription) => subscription.id !== id),
      })),
    }),
    {
      name: 'gasfinder-subscriptions',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted) => ({ ...(persisted as SubscriptionState), dismissedBankSuggestions: [] }),
    },
  ),
);
