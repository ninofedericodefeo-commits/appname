import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FuelType, SortOption } from '@/types/stations';
import { validateRefillPercent } from '@/features/stations/preferences';
import type { MapsApp } from '@/features/stations/preferences';

type SettingsState = {
  selectedFuelType: FuelType;
  selectedRadius: number;
  sortOrder: SortOption;
  hideUnpricedStations: boolean;
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
  selectedFuelType: 'regular',
  selectedRadius: 5,
  sortOrder: 'price',
  hideUnpricedStations: false,
  setHideUnpricedStations: (hideUnpricedStations) => set({ hideUnpricedStations }),
  mapsPreference: null,
  refillPercent: 10,
  setMapsPreference: (mapsPreference) => set({ mapsPreference }),
  setRefillPercent: (percent) => set({ refillPercent: validateRefillPercent(percent) }),
  setSelectedFuelType: (selectedFuelType) => set({ selectedFuelType }),
  setSelectedRadius: (selectedRadius) => set({ selectedRadius }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
}); }, { name: 'gasfinder-settings', storage: createJSONStorage(() => appStorage), version: 1 }));
