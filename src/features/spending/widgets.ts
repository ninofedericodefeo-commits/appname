import { dataWritesBlocked } from '@/features/data/writeBarrier';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { usePocketStore } from '@/stores/pocketStore';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { availableCents } from '@/features/pocket/logic';
import { formatMoney } from '@/lib/money';
import { accountBalanceEstimate } from '@/features/pocket/balanceEstimate';
import { endRetiredActivities } from './widgetLogic';

export const accountWidgetsAvailable = Platform.OS === 'ios' && Constants.expoConfig?.extra?.goalWidgetAvailable === true;
let latestSnapshot = 0;
export async function syncAccountWidget() {
  if (dataWritesBlocked() || !accountWidgetsAvailable || !usePocketStore.persist.hasHydrated() || !useWidgetSettingsStore.persist.hasHydrated()) return;
  const generation = ++latestSnapshot;
  const { default: widget } = await import('@/widgets/AccountWidget');
  if (dataWritesBlocked() || generation !== latestSnapshot) return;
  const account = usePocketStore.getState(), settings = useWidgetSettingsStore.getState();
  const estimate = accountBalanceEstimate(account);
  const available = availableCents(estimate.estimatedCents, account.reservedCents);
  widget.updateSnapshot({ enabled: settings.enabled,
    balance: !settings.enabled ? '' : settings.showAmounts ? available === null ? 'Add a bank balance' : formatMoney(available) : 'Balance hidden',
    savings: settings.enabled && settings.showAmounts ? `${formatMoney(account.reservedCents)} set aside` : 'Open Account to view amounts',
    updated: settings.enabled ? `Bank balance${estimate.snapshotDay ? ` · ${estimate.snapshotDay}` : ''}${estimate.newerCount ? ` + ${estimate.newerCount} updates` : ''} · not a live bank feed` : '',
  });
}

// Retain the old factory name only to dismiss activities created by older builds.
export async function endRetiredPurchaseActivities() {
  if (dataWritesBlocked() || !accountWidgetsAvailable || !useWidgetSettingsStore.persist.hasHydrated()) return;
  const { default: factory } = await import('@/widgets/PurchasePauseActivity');
  await endRetiredActivities(factory.getInstances());
  if (useWidgetSettingsStore.getState().trackedPurchaseId !== null) useWidgetSettingsStore.getState().setTrackedPurchaseId(null);
}
