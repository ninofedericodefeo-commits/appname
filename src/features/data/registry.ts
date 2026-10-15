import { usePocketStore } from '@/stores/pocketStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDriveStore } from '@/stores/driveStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { useInvestmentStore } from '@/stores/investmentStore';
import { useShortcutSetupStore } from '@/stores/shortcutSetupStore';
import { useStatementAutomationStore } from '@/stores/statementAutomationStore';
import type { StoreRecord } from './backupFormat';
import { validateStoreState } from './validation';

type ManagedStore = {
  getState: () => Record<string, unknown>;
  getInitialState: () => Record<string, unknown>;
  setState: (state: Record<string, unknown>, replace?: true) => void;
  persist: { hasHydrated: () => boolean; rehydrate: () => Promise<void> | void; getOptions: () => {
    name: string; version?: number; partialize?: (state: Record<string, unknown>) => unknown;
    migrate?: (state: unknown, version: number) => unknown | Promise<unknown>;
  } };
};
export const managedStores = [usePocketStore, useSubscriptionStore, useSettingsStore, useDriveStore, useReceiptStore, usePriceReportStore, useWidgetSettingsStore, useGasSearchStore, useInvestmentStore, useShortcutSetupStore, useStatementAutomationStore] as unknown as ManagedStore[];
const serial = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
const persisted = (store: ManagedStore, state: Record<string, unknown>) => serial(store.persist.getOptions().partialize?.(state) ?? state);
export function captureStores(initial = false): Record<string, StoreRecord> {
  return Object.fromEntries(managedStores.map(store => {
    const options = store.persist.getOptions();
    return [options.name, { version: options.version ?? 0, state: persisted(store, initial ? store.getInitialState() : store.getState()) }];
  }));
}
export async function prepareStores(records: Record<string, StoreRecord>) {
  const names = managedStores.map(store => store.persist.getOptions().name);
  if (Object.keys(records).some(name => !names.includes(name))) throw new Error('Backup contains data from a newer or unsupported app. Update GasFinder before restoring.');
  const prepared: Record<string, StoreRecord> = {};
  for (const store of managedStores) {
    const options = store.persist.getOptions(), record = records[options.name];
    if (!record || !Number.isInteger(record.version) || record.version < 0 || record.version > (options.version ?? 0)) throw new Error(`Missing or unsupported data version: ${options.name}.`);
    const defaults = persisted(store, store.getInitialState());
    const migrated = record.version === (options.version ?? 0) ? record.state : options.migrate ? await options.migrate(record.state, record.version) : null;
    if (!migrated || typeof migrated !== 'object' || Array.isArray(migrated)) throw new Error(`Cannot migrate ${options.name}.`);
    if (record.version === (options.version ?? 0)) validateStoreState(options.name, serial(migrated), defaults);
    const state = { ...defaults, ...serial(migrated) };
    validateStoreState(options.name, state, defaults);
    prepared[options.name] = { version: options.version ?? 0, state };
  }
  return prepared;
}
export function applyStores(records: Record<string, StoreRecord>) {
  for (const store of managedStores) store.setState({ ...store.getInitialState(), ...records[store.persist.getOptions().name].state }, true);
}
export async function rehydrateStores() {
  await Promise.all(managedStores.map(async store => { await store.persist.rehydrate(); if (!store.persist.hasHydrated()) throw new Error('Saved data could not be read. Restore a known backup or retry.'); }));
}

export function resetStores() { for (const store of managedStores) store.setState(store.getInitialState(), true); }
