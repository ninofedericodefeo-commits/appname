import { requireOptionalNativeModule } from 'expo';
import { AppState, Platform } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDataStatus, useDataStatus } from '@/features/data/operationStatus';
import { useAmountsHidden, useAmountVisibility } from '@/features/preferences/amountVisibility';
import { useDevicePrivacy, usePrivacySession } from '@/features/privacy/deviceStore';
import { usePocketStore } from '@/stores/pocketStore';
import { parsePendingWalletPurchases, pendingWalletId, type PendingWalletPurchase } from './purchaseInbox';

type InboxModule = { getVersion: () => number; listPending: () => unknown | Promise<unknown>; removePending: (id: string) => unknown | Promise<unknown>; clearPending: () => unknown | Promise<unknown> };
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<InboxModule>('PurchaseInbox') : null;
const listeners = new Set<() => void>();
export const purchaseInboxAvailable = () => !!native && native.getVersion() === 1;
export const isPurchaseInboxAvailable = purchaseInboxAvailable;
export function canReadPurchaseInbox() {
  const status = getDataStatus();
  return purchaseInboxAvailable() && usePocketStore.persist.hasHydrated() && useDevicePrivacy.persist.hasHydrated() && !status.busy && !status.recoveryError && AppState.currentState === 'active' && !(useDevicePrivacy.getState().hideAmounts && !useAmountVisibility.getState().revealed) && (!useDevicePrivacy.getState().enabled || usePrivacySession.getState().unlocked);
}
export async function listPendingWalletPurchases(): Promise<PendingWalletPurchase[]> {
  if (!canReadPurchaseInbox()) return [];
  const values = await native!.listPending();
  return canReadPurchaseInbox() ? parsePendingWalletPurchases(values) : [];
}
export async function removePendingWalletPurchase(id: string) {
  if (!pendingWalletId(id) || !canReadPurchaseInbox()) throw new Error('Unlock Tally before changing pending purchases.');
  await native!.removePending(id);
  listeners.forEach(listener => listener());
}
// Called by explicit erase-all after its data barrier is established, without reading financial drafts.
export async function clearPurchaseInbox() {
  if (purchaseInboxAvailable()) {
    const result = await native!.clearPending();
    if (result === false) throw new Error('Pending Wallet purchases could not be erased.');
    listeners.forEach(listener => listener());
  }
}
const subscribeAppState = (notify: () => void) => { const subscription = AppState.addEventListener('change', notify); return () => subscription.remove(); };
export function usePendingWalletPurchases() {
  const { busy, recoveryError, revision } = useDataStatus();
  const enabled = useDevicePrivacy(state => state.enabled), unlocked = usePrivacySession(state => state.unlocked);
  const hidden = useAmountsHidden();
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const privacyReady = useSyncExternalStore(useDevicePrivacy.persist.onFinishHydration, useDevicePrivacy.persist.hasHydrated, () => false);
  const active = useSyncExternalStore(subscribeAppState, () => AppState.currentState === 'active', () => false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingWalletPurchase[]>([]), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const allowed = ready && privacyReady && active && !busy && !recoveryError && (!enabled || unlocked) && !hidden;
  useEffect(() => { const listener = () => setRefresh(value => value + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(async () => {
      if (!current) return;
      setItems([]); setError(''); setLoading(allowed);
      if (!allowed) return [];
      return listPendingWalletPurchases();
    }).then(rows => { if (current && canReadPurchaseInbox()) { setItems(rows ?? []); setLoading(false); } }).catch(() => { if (current) { setError('Pending Wallet purchases could not be loaded. Try again after unlocking your phone.'); setLoading(false); } });
    return () => { current = false; };
  }, [allowed, refresh, revision]);
  return { items: allowed ? items : [], error: allowed ? error : '', available: purchaseInboxAvailable(), loading: allowed && loading, refresh: () => setRefresh(value => value + 1), allowed };
}
