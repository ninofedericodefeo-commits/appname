import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { validateCar } from '@/features/vehicles/logic';
import type { CarProfile } from '@/features/vehicles/logic';

type DriveState = {
  cars: CarProfile[];
  selectedCarId: string | null;
  lastDestination: string;
  saveCar: (car: CarProfile) => void;
  deleteCar: (id: string) => void;
  selectCar: (id: string) => void;
  setDestination: (destination: string) => void;
};

export const useDriveStore = create<DriveState>()(persist((set) => ({
  cars: [], selectedCarId: null, lastDestination: '',
  saveCar: (car) => { const validated = validateCar(car); set((state) => ({ cars: [...state.cars.filter((item) => item.id !== car.id), validated], selectedCarId: car.id })); },
  deleteCar: (id) => set((state) => ({ cars: state.cars.filter((car) => car.id !== id), selectedCarId: state.selectedCarId === id ? state.cars.find((car) => car.id !== id)?.id ?? null : state.selectedCarId })),
  selectCar: (id) => set((state) => state.cars.some((car) => car.id === id) ? { selectedCarId: id } : {}),
  setDestination: (lastDestination) => set({ lastDestination: lastDestination.trim().slice(0, 4000) }),
}), { name: 'gasfinder-drive-profile', storage: createJSONStorage(() => AsyncStorage), version: 1 }));
