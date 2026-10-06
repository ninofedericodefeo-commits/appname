import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalPriceReport } from '@/types/priceReports';

type PriceReportState = {
  reports: LocalPriceReport[];
  saveReport: (report: LocalPriceReport) => void;
  removeReport: (id: string) => void;
};

export const usePriceReportStore = create<PriceReportState>()(
  persist(
    (set) => ({
      reports: [],
      saveReport: (report) => set((state) => ({
        reports: [report, ...state.reports.filter((item) => item.id !== report.id)],
      })),
      removeReport: (id) => set((state) => ({ reports: state.reports.filter((item) => item.id !== id) })),
    }),
    { name: 'gasfinder-local-price-reports', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
