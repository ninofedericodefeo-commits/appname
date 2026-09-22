import { create } from 'zustand';

import type { FuelType, SortOption } from '@/types/stations';

type SettingsState = {
  selectedFuelType: FuelType;
  selectedRadius: number;
  sortOrder: SortOption;
  setSelectedFuelType: (fuelType: FuelType) => void;
  setSelectedRadius: (radius: number) => void;
  setSortOrder: (sortOrder: SortOption) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  selectedFuelType: 'regular',
  selectedRadius: 5,
  sortOrder: 'price',
  setSelectedFuelType: (selectedFuelType) => set({ selectedFuelType }),
  setSelectedRadius: (selectedRadius) => set({ selectedRadius }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
}));
