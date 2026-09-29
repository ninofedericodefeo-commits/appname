import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { canReserve } from '@/features/pocket/logic';

type PocketEntry = { id: string; amountCents: number; createdAt: string; kind: 'reserve' | 'release' };
type PocketState = {
  reportedBalanceCents: number | null;
  balanceUpdatedAt: string | null;
  reservedCents: number;
  entries: PocketEntry[];
  setReportedBalance: (cents: number) => void;
  reserve: (cents: number) => boolean;
  release: (cents: number) => boolean;
};

function entry(kind: PocketEntry['kind'], amountCents: number): PocketEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amountCents, createdAt: new Date().toISOString(), kind };
}

export const usePocketStore = create<PocketState>()(
  persist(
    (set, get) => ({
      reportedBalanceCents: null,
      balanceUpdatedAt: null,
      reservedCents: 0,
      entries: [],
      setReportedBalance: (cents) => {
        if (Number.isSafeInteger(cents) && cents >= 0) set({ reportedBalanceCents: cents, balanceUpdatedAt: new Date().toISOString() });
      },
      reserve: (cents) => {
        const state = get();
        if (!canReserve(cents, state.reportedBalanceCents, state.reservedCents)) return false;
        set({ reservedCents: state.reservedCents + cents, entries: [entry('reserve', cents), ...state.entries] });
        return true;
      },
      release: (cents) => {
        const state = get();
        if (!Number.isSafeInteger(cents) || cents <= 0 || cents > state.reservedCents) return false;
        set({ reservedCents: state.reservedCents - cents, entries: [entry('release', cents), ...state.entries] });
        return true;
      },
    }),
    { name: 'gasfinder-savings-pocket', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
