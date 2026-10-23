import { mergePersistedState } from '@/lib/persistedState';
import { accessibilityDefaults, validAccessibilityPreferences } from '@/features/accessibility/preferences';
import type { AccessibilityPreferences } from '@/features/accessibility/preferences';
import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PriceQualifier } from '@/types/fuelReports';
import type { FuelType, SortOption } from '@/types/stations';
import { validateRefillPercent } from '@/features/stations/preferences';
import type { MapsApp } from '@/features/stations/preferences';

export type PersonalPreferences = AccessibilityPreferences & {
  appearance: 'system' | 'light' | 'dark';
  strongerContrast: boolean;
  startScreen: 'index' | 'investment' | 'pocket' | 'subscriptions';
  gasView: 'map' | 'list'; subscriptionView: 'list' | 'calendar';
  reminderHour: number; reminderLeadDays: number;
  setupDismissed: boolean;
};
export const personalDefaults: PersonalPreferences = { ...accessibilityDefaults, appearance: 'system', strongerContrast: false, startScreen: 'pocket', gasView: 'map', subscriptionView: 'list', reminderHour: 9, reminderLeadDays: 1, setupDismissed: false };
type SettingsState = PersonalPreferences & {
  configure: (change: Partial<PersonalPreferences>) => void;
  statementReminderDays: number;
  budgets: Record<string, number>;
  setStatementReminderDays: (days: number) => void;
  setBudget: (category: string, cents: number) => void;
  selectedFuelType: FuelType;
  selectedRadius: number;
  sortOrder: SortOption;
  hideUnpricedStations: boolean;
  hideUnnamedStations: boolean;
  setHideUnnamedStations: (hide: boolean) => void;
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
  ...personalDefaults, configure: change => {
    if (change.appearance && !['system','light','dark'].includes(change.appearance) || change.startScreen && !['index','investment','pocket','subscriptions'].includes(change.startScreen) || change.gasView && !['map','list'].includes(change.gasView) || change.subscriptionView && !['list','calendar'].includes(change.subscriptionView) || change.reminderHour !== undefined && (!Number.isInteger(change.reminderHour) || change.reminderHour < 0 || change.reminderHour > 23) || change.reminderLeadDays !== undefined && ![0,1,2,3,7].includes(change.reminderLeadDays)) throw Error('Choose supported preferences.');
    if (!validAccessibilityPreferences(change)) throw Error('Choose supported accessibility preferences.');
    set(change);
  },
  statementReminderDays: 0, budgets: {},
  setStatementReminderDays: days => { if (![0, 30, 45, 60, 90].includes(days)) throw Error('Choose a reminder cadence.'); set({ statementReminderDays: days }); },
  setBudget: (category, cents) => { if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000 || category.length > 40) throw Error('Enter a valid budget.'); set(state => ({ budgets: { ...state.budgets, [category]: cents } })); },
  selectedFuelType: 'regular',
  selectedRadius: 5,
  sortOrder: 'price',
  hideUnpricedStations: false,
  hideUnnamedStations: false,
  setHideUnnamedStations: hideUnnamedStations => set({ hideUnnamedStations }),
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
}); }, { name: 'gasfinder-settings', storage: createJSONStorage(() => appStorage), merge: mergePersistedState, version: 7, migrate: (state, version) => {
  const saved = state as Partial<SettingsState>;
  return { ...personalDefaults, statementReminderDays: 0, budgets: {}, recentPricesOnly: false, priceQualifier: 'standard', hideUnnamedStations: false, ...saved,
    startScreen: version < 7 && saved.startScreen === 'index' ? 'pocket' : saved.startScreen ?? personalDefaults.startScreen };
} }));
