import { appStorage } from '@/lib/appStorage';
import { guardedSet } from '@/features/data/writeBarrier';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { validateCar } from '@/features/vehicles/logic';
import type { CarProfile } from '@/features/vehicles/logic';

type DriveState = {
  destinations: string[];
  preferredStationIds: string[];
  avoidedStationIds: string[];
  saveDestination: (destination: string) => void;
  removeDestination: (destination: string) => void;
  setStationPreference: (id: string, preference: 'prefer' | 'avoid' | 'none') => void;
  cars: CarProfile[];
  selectedCarId: string | null;
  lastDestination: string;
  saveCar: (car: CarProfile) => void;
  deleteCar: (id: string) => void;
  selectCar: (id: string) => void;
  setDestination: (destination: string) => void;
};

export const useDriveStore = create<DriveState>()(persist((rawSet) => { const set = guardedSet(rawSet); return ({
  destinations: [], preferredStationIds: [], avoidedStationIds: [],
  saveDestination: input => { const destination = input.trim(); if (!destination || destination.length > 4000) throw Error('Enter a destination first.'); set(state => ({ destinations: [...new Set([destination,...state.destinations])].slice(0,20) })); },
  removeDestination: destination => set(state => ({ destinations: state.destinations.filter(item => item !== destination) })),
  setStationPreference: (id, preference) => set(state => ({ preferredStationIds: [...state.preferredStationIds.filter(value => value !== id), ...(preference === 'prefer' ? [id] : [])].slice(-100), avoidedStationIds: [...state.avoidedStationIds.filter(value => value !== id), ...(preference === 'avoid' ? [id] : [])].slice(-100) })),
  cars: [], selectedCarId: null, lastDestination: '',
  saveCar: (car) => { const validated = validateCar(car); set((state) => ({ cars: [...state.cars.filter((item) => item.id !== car.id), validated], selectedCarId: car.id })); },
  deleteCar: (id) => set((state) => ({ cars: state.cars.filter((car) => car.id !== id), selectedCarId: state.selectedCarId === id ? state.cars.find((car) => car.id !== id)?.id ?? null : state.selectedCarId })),
  selectCar: (id) => set((state) => state.cars.some((car) => car.id === id) ? { selectedCarId: id } : {}),
  setDestination: (lastDestination) => set({ lastDestination: lastDestination.trim().slice(0, 4000) }),
}); }, { name: 'gasfinder-drive-profile', storage: createJSONStorage(() => appStorage), version: 2, migrate: state => ({ destinations: [], preferredStationIds: [], avoidedStationIds: [], ...(state as object) }) }));
