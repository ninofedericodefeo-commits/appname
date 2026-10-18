import { useSyncExternalStore } from 'react';
let state = { busy: false, recoveryError: '', revision: 0, notice: '' };
const listeners = new Set<() => void>();
export function updateDataStatus(change: Partial<typeof state>) { state = { ...state, ...change }; listeners.forEach(listener => listener()); }
export function getDataStatus() { return state; }
export function useDataStatus() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state, () => state); }

export function markDataReplacement(notice: string) { updateDataStatus({ revision: state.revision + 1, notice }); }
