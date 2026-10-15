import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PriceQualifier } from '@/types/fuelReports';
import type { FuelType, SortOption } from '@/types/stations';
import { validateRefillPercent } from '@/features/stations/preferences';
import type { MapsApp } from '@/features/stations/preferences';

type SettingsState = {
  statementReminderDays: number;
  budgets: Record<string, number>;
  setStatementReminderDays: (days: number) => void;
  setBudget: (category: string, cents: number) => void;
  selectedFuelType: FuelType;
  selectedRadius: number;
  sortOrder: SortOption;
  hideUnpricedStations: boolean;
  recentPricesOnly: boolean;
  priceQualifier: PriceQualifier;
  setRecentPricesOnly: (value: boolean) => void;
  setPriceQualifier: (value: PriceQualifier) => void;
  setHideUnpricedStations: (hide: boolean) => void;
  mapsPreference: MapsApp | null;
  refillPercent: number;
  setMapsPreference: (app: MapsApp) => void;
  setRefillPercent: (percent: number) => void;
  setSelectedFuelType: (fuelType: FuelType) => void;
  setSelectedRadius: (radius: number) => void;
  setSortOrder: (sortOrder: SortOption) => void;
};

export const useSettingsStore = create<SettingsState>()(persist((rawSet) => { const set = guardedSet(rawSet); return ({
  statementReminderDays: 0, budgets: {},
  setStatementReminderDays: days => { if (![0, 30, 45, 60, 90].includes(days)) throw Error('Choose a reminder cadence.'); set({ statementReminderDays: days }); },
  setBudget: (category, cents) => { if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000 || category.length > 40) throw Error('Enter a valid budget.'); set(state => ({ budgets: { ...state.budgets, [category]: cents } })); },
  selectedFuelType: 'regular',
  selectedRadius: 5,
  sortOrder: 'price',
  hideUnpricedStations: false,
  recentPricesOnly: false, priceQualifier: 'standard',
  setRecentPricesOnly: recentPricesOnly => set({ recentPricesOnly }),
  setPriceQualifier: priceQualifier => set({ priceQualifier }),
  setHideUnpricedStations: (hideUnpricedStations) => set({ hideUnpricedStations }),
  mapsPreference: null,
  refillPercent: 10,
  setMapsPreference: (mapsPreference) => set({ mapsPreference }),
  setRefillPercent: (percent) => set({ refillPercent: validateRefillPercent(percent) }),
  setSelectedFuelType: (selectedFuelType) => set({ selectedFuelType }),
  setSelectedRadius: (selectedRadius) => set({ selectedRadius }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
}); }, { name: 'gasfinder-settings', storage: createJSONStorage(() => appStorage), version: 3, migrate: state => ({ statementReminderDays: 0, budgets: {}, recentPricesOnly: false, priceQualifier: 'standard', ...(state as object) }) }));
