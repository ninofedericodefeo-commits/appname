import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { usePocketStore } from '@/stores/pocketStore';
import { usePurchasePauseStore } from '@/stores/purchasePauseStore';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { availableCents } from '@/features/pocket/logic';
import { formatMoney } from '@/lib/money';
import { pauseActivityProps, reconcilePauseActivities } from './widgetLogic';

export const accountWidgetsAvailable = Platform.OS === 'ios' && Constants.expoConfig?.extra?.goalWidgetAvailable === true;
let latestSnapshot = 0;
let activityQueue: Promise<unknown> = Promise.resolve();
function activityAction<T>(action: () => Promise<T>): Promise<T> {
  const next = activityQueue.then(action); activityQueue = next.catch(() => {}); return next;
}
export async function syncAccountWidget() {
  if (!accountWidgetsAvailable || !usePocketStore.persist.hasHydrated() || !useWidgetSettingsStore.persist.hasHydrated() || !usePurchasePauseStore.persist.hasHydrated()) return;
  const generation = ++latestSnapshot;
  const { default: widget } = await import('@/widgets/AccountWidget');
  if (generation !== latestSnapshot) return;
  const account = usePocketStore.getState(), settings = useWidgetSettingsStore.getState();
  const available = availableCents(account.reportedBalanceCents, account.reservedCents);
  widget.updateSnapshot({ enabled: settings.enabled,
    balance: !settings.enabled ? '' : settings.showAmounts ? available === null ? 'Add a bank balance' : formatMoney(available) : 'Balance hidden',
    savings: settings.enabled && settings.showAmounts ? `${formatMoney(account.reservedCents)} set aside` : 'Open Account to view amounts',
    waiting: settings.enabled ? usePurchasePauseStore.getState().items.filter(item => item.status === 'waiting').length : 0,
    updated: settings.enabled ? `Saved balance${account.balanceAsOf ? ` · ${account.balanceAsOf}` : ''} · not a live bank feed` : '',
  });
}

export function trackPurchasePause(itemId: string) {
  return activityAction(async () => {
    if (!accountWidgetsAvailable) throw Error('Live Activities need an iPhone build with widgets enabled.');
    const { default: factory } = await import('@/widgets/PurchasePauseActivity');
    const item = usePurchasePauseStore.getState().items.find(item => item.id === itemId && item.status === 'waiting' && item.reviewAt > Date.now());
    if (!item) throw Error('This purchase is ready to review or is no longer waiting.');
    for (const instance of factory.getInstances()) await instance.end('immediate');
    factory.start(pauseActivityProps(item), 'gasfinder://subscriptions', new Date(item.reviewAt));
    useWidgetSettingsStore.getState().setTrackedPurchaseId(item.id);
  });
}
export function endPauseActivities() {
  return activityAction(async () => {
    if (!accountWidgetsAvailable) return;
    const { default: factory } = await import('@/widgets/PurchasePauseActivity');
    for (const instance of factory.getInstances()) await instance.end('immediate');
    useWidgetSettingsStore.getState().setTrackedPurchaseId(null);
  });
}

export function syncPauseActivities() {
  return activityAction(async () => {
    if (!accountWidgetsAvailable || !usePurchasePauseStore.persist.hasHydrated() || !useWidgetSettingsStore.persist.hasHydrated()) return;
    const { default: factory } = await import('@/widgets/PurchasePauseActivity');
    await reconcilePauseActivities(factory.getInstances(), useWidgetSettingsStore.getState().trackedPurchaseId, usePurchasePauseStore.getState().items);
  });
}
