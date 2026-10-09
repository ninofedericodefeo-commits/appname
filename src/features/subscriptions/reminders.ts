import { formatMoney } from '@/lib/money';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { upcomingReminderGroups } from '@/features/subscriptions/logic';
import type { Subscription } from '@/features/subscriptions/logic';

const channelId = 'subscription-reviews';
const notificationKind = 'subscription-review';
let syncQueue: Promise<void> = Promise.resolve();

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Subscription reviews',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function permissionAllowsAlerts(settings: Notifications.NotificationPermissionsStatus) {
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestSubscriptionReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel();
  let settings = await Notifications.getPermissionsAsync();
  if (!permissionAllowsAlerts(settings)) {
    settings = await Notifications.requestPermissionsAsync();
  }
  return permissionAllowsAlerts(settings);
}

async function syncNow(subscriptions: Subscription[], enabled: boolean) {
  if (Platform.OS === 'web') return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of existing) {
    if (request.content.data?.kind === notificationKind) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  if (!enabled || !permissionAllowsAlerts(await Notifications.getPermissionsAsync())) return;
  await ensureChannel();

  for (const group of upcomingReminderGroups(subscriptions, new Date())) {
    const count = group.names.length;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: count === 1 ? 'Review a subscription tomorrow' : `Review ${count} subscriptions tomorrow`,
        body: `Estimated renewal total: ${formatMoney(group.totalCents)}. Open GasFinder to decide what to keep.`,
        data: { kind: notificationKind, url: '/subscriptions' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: group.at,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
    });
  }
}

export function syncSubscriptionReminders(subscriptions: Subscription[], enabled: boolean): Promise<void> {
  syncQueue = syncQueue.catch(() => undefined).then(() => syncNow(subscriptions, enabled));
  return syncQueue;
}
