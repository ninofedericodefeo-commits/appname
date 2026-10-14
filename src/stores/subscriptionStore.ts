import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { replaceSampleSubscriptions } from '@/features/subscriptions/samples';

import { bankMerchant } from '@/features/subscriptions/bankSuggestions';
import type { Subscription } from '@/features/subscriptions/logic';
import { clearSampleSnoozes, migrateReviewPreferences, snoozeRenewalReviews } from '@/features/subscriptions/reviewPreferences';
import type { RenewalSnoozes } from '@/features/subscriptions/reviewPreferences';

type SubscriptionInput = Pick<Subscription, 'name' | 'amountCents' | 'cadence' | 'day' | 'month' | 'bankMerchantKey' | 'associatedApp'>;

type SubscriptionState = {
  subscriptions: Subscription[];
  remindersEnabled: boolean;
  samplesInitialized: boolean;
  sampleMode: boolean;
  setSampleMode: (enabled: boolean) => void;
  reviewSnoozes: RenewalSnoozes;
  snoozeReviews: (duration: 'two-hours' | 'today') => void;
  resumeReviews: () => void;
  initializeSamples: () => void;
  resetSamples: () => void;
  removeSamples: () => void;
  dismissedBankSuggestions: string[];
  dismissedBankAlerts: string[];
  dismissBankAlert: (id: string) => void;
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
      samplesInitialized: false,
      sampleMode: false,
      reviewSnoozes: {},
      snoozeReviews: duration => set(state => ({ reviewSnoozes: snoozeRenewalReviews(state.subscriptions, state.sampleMode, state.reviewSnoozes, duration) })),
      resumeReviews: () => set({ reviewSnoozes: {} }),
      setSampleMode: sampleMode => set(state => ({ sampleMode, ...(sampleMode && !state.subscriptions.some(item => item.isSample) ? { subscriptions: replaceSampleSubscriptions(state.subscriptions), samplesInitialized: true } : {}) })),
      initializeSamples: () => set(state => !state.sampleMode || state.samplesInitialized ? state : { subscriptions: replaceSampleSubscriptions(state.subscriptions), samplesInitialized: true }),
      resetSamples: () => set(state => ({ subscriptions: replaceSampleSubscriptions(state.subscriptions), samplesInitialized: true, sampleMode: true, reviewSnoozes: clearSampleSnoozes(state.subscriptions, state.reviewSnoozes) })),
      removeSamples: () => set(state => ({ subscriptions: state.subscriptions.filter(subscription => !subscription.isSample), samplesInitialized: true, sampleMode: false, reviewSnoozes: clearSampleSnoozes(state.subscriptions, state.reviewSnoozes) })),
      dismissedBankSuggestions: [],
      dismissedBankAlerts: [],
      dismissBankAlert: id => set(state => ({ dismissedBankAlerts: [...new Set([...state.dismissedBankAlerts, id])] })),
      dismissBankSuggestion: (key) => set((state) => ({ dismissedBankSuggestions: [...new Set([...state.dismissedBankSuggestions, key])] })),
      restoreBankSuggestions: () => set({ dismissedBankSuggestions: [] }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      saveSubscription: (input, id) => set((state) => {
        if (id) {
          return {
            subscriptions: state.subscriptions.map((subscription) => {
              if (subscription.id !== id) return subscription;
              const reviewChanged = subscription.name !== input.name || subscription.amountCents !== input.amountCents ||
                subscription.cadence !== input.cadence || subscription.day !== input.day || subscription.month !== input.month;
              return { ...subscription, ...input, ...(subscription.amountCents !== input.amountCents ? { amountUpdatedAt: new Date().toISOString() } : {}), lastReview: reviewChanged ? undefined : subscription.lastReview };
            }),
          };
        }
        if (input.bankMerchantKey && state.subscriptions.some((subscription) => !subscription.isSample && (subscription.bankMerchantKey === input.bankMerchantKey || bankMerchant(subscription.name).key === input.bankMerchantKey))) return state;
        const subscription: Subscription = {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          active: true,
          createdAt: new Date().toISOString(),
        };
        return { subscriptions: [subscription, ...state.subscriptions] };
      }),
      setActive: (id, active) => set((state) => ({
        subscriptions: state.subscriptions.map((subscription) =>
          subscription.id === id ? { ...subscription, active, canceledAt: active ? undefined : new Date().toISOString(), ...(active ? { amountUpdatedAt: new Date().toISOString() } : {}) } : subscription,
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
      version: 5,
      migrate: (persisted, version) => ({ ...(persisted as SubscriptionState),
        ...migrateReviewPreferences(persisted as SubscriptionState),
        dismissedBankSuggestions: version < 2 ? [] : (persisted as SubscriptionState).dismissedBankSuggestions ?? [],
        samplesInitialized: (persisted as SubscriptionState).samplesInitialized ?? false,
        dismissedBankAlerts: (persisted as SubscriptionState).dismissedBankAlerts ?? [],
        subscriptions: ((persisted as SubscriptionState).subscriptions ?? []).map(subscription => ({ ...subscription,
          createdAt: subscription.createdAt ?? (/^\d{13}-/.test(subscription.id) ? new Date(Number(subscription.id.split('-')[0])).toISOString() : new Date().toISOString()),
        })),
      }),
    },
  ),
);
