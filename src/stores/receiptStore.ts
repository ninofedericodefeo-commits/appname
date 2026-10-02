import AsyncStorage from '@react-native-async-storage/async-storage';
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
    (set) => ({
      reports: [],
      addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
      removeReport: (id) => set((state) => ({ reports: state.reports.filter((report) => report.id !== id) })),
    }),
    {
      name: 'gasfinder-receipt-reports',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
