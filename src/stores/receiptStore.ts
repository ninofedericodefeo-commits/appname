import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ReceiptReport } from '@/types/receipts';

type ReceiptState = {
  reports: ReceiptReport[];
  addReport: (report: ReceiptReport) => void;
  removeReport: (id: string) => void;
};

export const useReceiptStore = create<ReceiptState>()(
  persist(
    (rawSet) => { const set = guardedSet(rawSet); return ({
      reports: [],
      addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
      removeReport: (id) => set((state) => ({ reports: state.reports.filter((report) => report.id !== id) })),
    }); },
    {
      name: 'gasfinder-receipt-reports',
      storage: createJSONStorage(() => appStorage),
      version: 1,
    },
  ),
);
