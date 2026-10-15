import type { StoreApi } from 'zustand';
let blocked = false;
export function setDataWritesBlocked(value: boolean) { blocked = value; }
export function dataWritesBlocked() { return blocked; }
export function assertDataWritesAllowed() { if (blocked) throw new Error('Data recovery is in progress. Try this action again when it finishes.'); }
export function guardedSet<T>(set: StoreApi<T>['setState']): StoreApi<T>['setState'] {
  return ((...args: Parameters<StoreApi<T>['setState']>) => { assertDataWritesAllowed(); return set(...args); }) as StoreApi<T>['setState'];
}
