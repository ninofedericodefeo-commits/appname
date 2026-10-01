import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PurchasePauseItem } from '@/types/investing';
import type {
  DemoPurchaseCheck,
  DemoPurchaseOutcome,
  FamilyMember,
  FamilyPurchaseRequest,
  SpendingCategory,
} from '@/types/spending';

export type PurchasePauseDelayHours = 24 | 48 | 168;
export type SpendingPauseHours = 1 | 6 | 24 | 168;

type PurchasePauseState = {
  enabled: boolean;
  delayHours: PurchasePauseDelayHours;
  items: PurchasePauseItem[];
  pauseEndsAt: number | null;
  spendingChecks: DemoPurchaseCheck[];
  familyMembers: FamilyMember[];
  familyRequests: FamilyPurchaseRequest[];
  setEnabled: (enabled: boolean) => void;
  setDelayHours: (hours: PurchasePauseDelayHours) => void;
  addPurchase: (name: string, amount: number) => void;
  recordOutcome: (id: string, outcome: 'bought' | 'skipped') => void;
  startSpendingPause: (hours: SpendingPauseHours) => void;
  endSpendingPause: () => void;
  checkDemoPurchase: (name: string, amount: number, category: SpendingCategory) => DemoPurchaseOutcome;
  addFamilyMember: (name: string, weeklyLimit: number) => void;
  setFamilyLimit: (memberId: string, weeklyLimit: number) => void;
  addFamilyRequest: (memberId: string, description: string, amount: number) => void;
  decideFamilyRequest: (requestId: string, decision: 'approved' | 'denied') => boolean;
};

export const usePurchasePauseStore = create<PurchasePauseState>()(
  persist(
    (set, get) => ({
      enabled: false,
      delayHours: 24,
      items: [],
      pauseEndsAt: null,
      spendingChecks: [],
      familyMembers: [],
      familyRequests: [],
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
      startSpendingPause: (hours) => set({ pauseEndsAt: Date.now() + hours * 60 * 60 * 1000 }),
      endSpendingPause: () => set({ pauseEndsAt: null }),
      checkDemoPurchase: (name, amount, category) => {
        const pauseIsActive = (get().pauseEndsAt ?? 0) > Date.now();
        const outcome: DemoPurchaseOutcome =
          category === 'automatic-payment'
            ? 'bill-exempt'
            : pauseIsActive
              ? 'paused'
              : 'allowed';
        const check: DemoPurchaseCheck = {
          id: `${Date.now()}-${Math.random()}`,
          name: name.trim(),
          amount: Math.round(amount * 100) / 100,
          category,
          outcome,
          createdAt: Date.now(),
        };
        set((state) => ({ spendingChecks: [check, ...state.spendingChecks] }));
        return outcome;
      },
      addFamilyMember: (name, weeklyLimit) =>
        set((state) => ({
          familyMembers: [
            {
              id: `${Date.now()}-${Math.random()}`,
              name: name.trim(),
              weeklyLimit: Math.round(weeklyLimit * 100) / 100,
              createdAt: Date.now(),
            },
            ...state.familyMembers,
          ],
        })),
      setFamilyLimit: (memberId, weeklyLimit) =>
        set((state) => ({
          familyMembers: state.familyMembers.map((member) =>
            member.id === memberId ? { ...member, weeklyLimit: Math.round(weeklyLimit * 100) / 100 } : member,
          ),
        })),
      addFamilyRequest: (memberId, description, amount) =>
        set((state) => ({
          familyRequests: [
            {
              id: `${Date.now()}-${Math.random()}`,
              memberId,
              description: description.trim(),
              amount: Math.round(amount * 100) / 100,
              status: 'pending',
              createdAt: Date.now(),
            },
            ...state.familyRequests,
          ],
        })),
      decideFamilyRequest: (requestId, decision) => {
        const state = get();
        const request = state.familyRequests.find(
          (item) => item.id === requestId && item.status === 'pending',
        );
        if (!request) return false;

        if (decision === 'approved') {
          const member = state.familyMembers.find((item) => item.id === request.memberId);
          if (!member) return false;
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const approvedTotal = state.familyRequests
            .filter(
              (item) =>
                item.memberId === member.id &&
                item.status === 'approved' &&
                (item.decidedAt ?? item.createdAt) >= weekAgo,
            )
            .reduce((total, item) => total + item.amount, 0);
          if (approvedTotal + request.amount > member.weeklyLimit) return false;
        }

        set((current) => ({
          familyRequests: current.familyRequests.map((item) =>
            item.id === requestId && item.status === 'pending'
              ? { ...item, status: decision, decidedAt: Date.now() }
              : item,
          ),
        }));
        return true;
      },
    }),
    {
      name: 'gasfinder-purchase-pause-demo',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
