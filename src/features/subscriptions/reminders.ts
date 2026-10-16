import { useSettingsStore } from '@/stores/settingsStore';
import { useDevicePrivacy } from '@/features/privacy/deviceStore';
import { formatMoney } from '@/lib/money';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { upcomingReminderGroups } from '@/features/subscriptions/logic';
import type { Subscription } from '@/features/subscriptions/logic';
import type { ReminderStatus } from './reminderStatus';

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

  for (const group of upcomingReminderGroups(subscriptions, new Date(), { hour: useSettingsStore.getState().reminderHour, leadDays: useSettingsStore.getState().reminderLeadDays })) {
    const count = group.names.length;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: group.cancelNames?.length ? 'Follow up on subscription cancellation' : count === 1 ? 'Upcoming subscription renewal' : `${count} upcoming subscription renewals`,
        body: useDevicePrivacy.getState().hideAmounts ? 'Open GasFinder to review your subscriptions.' : group.cancelNames?.length ? `You planned to cancel ${group.cancelNames.length} subscription${group.cancelNames.length === 1 ? "" : "s"}. Open GasFinder to follow up.` : `Estimated renewal total: ${formatMoney(group.totalCents)}. Open GasFinder to decide what to keep.`,
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

export async function getSubscriptionReminderStatus(subscriptions: Subscription[], enabled: boolean): Promise<ReminderStatus> {
  if (Platform.OS === 'web') return { permission: 'unavailable', scheduledCount: 0, expectedCount: 0 };
  // Let queued scheduling/cancellation settle before describing what is on the phone.
  for (let attempt = 0; attempt < 3; attempt++) { const current = syncQueue; await current.catch(() => {}); if (current === syncQueue) break; }
  const settings = await Notifications.getPermissionsAsync();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const permission = settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ? 'quiet'
    : settings.ios?.status === Notifications.IosAuthorizationStatus.DENIED || settings.status === 'denied' ? 'denied'
    : permissionAllowsAlerts(settings) ? 'granted' : 'undetermined';
  return { permission, scheduledCount: scheduled.filter(item => item.content.data?.kind === notificationKind).length,
    expectedCount: enabled && permissionAllowsAlerts(settings) ? upcomingReminderGroups(subscriptions, new Date(), { hour: useSettingsStore.getState().reminderHour, leadDays: useSettingsStore.getState().reminderLeadDays }).length : 0 };
}
