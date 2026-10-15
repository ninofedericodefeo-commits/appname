import { useSyncExternalStore } from 'react';
let state = { busy: false, recoveryError: '' };
const listeners = new Set<() => void>();
export function updateDataStatus(change: Partial<typeof state>) { state = { ...state, ...change }; listeners.forEach(listener => listener()); }
export function useDataStatus() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state, () => state); }
