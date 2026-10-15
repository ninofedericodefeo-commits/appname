import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SearchArea, PlaceMatch } from '@/features/location/areaSearch';
import { placeQueryKey, validPoint } from '@/features/location/areaSearch';
import { rememberArea, rememberStations, toggleFavorite } from '@/features/stations/searchCache';
import type { PlaceCache, StationCache } from '@/features/stations/searchCache';
import type { GasStation } from '@/types/stations';

type GasSearchState = {
  lastArea: SearchArea | null;
  recentAreas: SearchArea[];
  stationCaches: StationCache[];
  placeCaches: PlaceCache[];
  favorites: GasStation[];
  chooseArea: (area: SearchArea) => void;
  saveStations: (cache: StationCache) => void;
  savePlaces: (query: string, matches: PlaceMatch[]) => void;
  toggleFavorite: (station: GasStation) => void;
};
export const useGasSearchStore = create<GasSearchState>()(persist(set => ({
  lastArea: null, recentAreas: [], stationCaches: [], placeCaches: [], favorites: [],
  chooseArea: area => { if (validPoint(area)) set(state => ({ lastArea: area, recentAreas: rememberArea(state.recentAreas, area) })); },
  saveStations: cache => set(state => ({ stationCaches: rememberStations(state.stationCaches, cache) })),
  savePlaces: (query, matches) => set(state => ({ placeCaches: [{ query: placeQueryKey(query), matches, fetchedAt: new Date().toISOString() }, ...state.placeCaches.filter(item => item.query !== placeQueryKey(query))].slice(0, 20) })),
  toggleFavorite: station => set(state => ({ favorites: toggleFavorite(state.favorites, station) })),
}), { name: 'gasfinder-gas-search', storage: createJSONStorage(() => AsyncStorage), version: 1 }));
