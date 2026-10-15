import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
let pending: Promise<unknown> = Promise.resolve();
let lastFailure: unknown;
const enqueue = (operation: () => Promise<unknown>) => {
  const current = pending.catch(() => undefined).then(operation);
  pending = current; current.catch(error => { lastFailure = error; }); return current;
};
export const appStorage: StateStorage = {
  async getItem(name) { await pending.catch(() => undefined); return AsyncStorage.getItem(name); },
  async setItem(name, value) { await enqueue(() => AsyncStorage.setItem(name, value)); },
  async removeItem(name) { await enqueue(() => AsyncStorage.removeItem(name)); },
};
export async function flushAppStorage() {
  try { await pending; } catch (error) { lastFailure = undefined; throw error; }
  if (lastFailure) { const error = lastFailure; lastFailure = undefined; throw error; }
}
