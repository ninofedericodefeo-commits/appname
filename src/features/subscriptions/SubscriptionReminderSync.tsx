import { useSettingsStore } from '@/stores/settingsStore';
import { useDevicePrivacy } from '@/features/privacy/deviceStore';
import { useDataStatus } from '@/features/data/operationStatus';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { localDateKey } from './logic';
import { syncSubscriptionReminders } from './reminders';

export default function SubscriptionReminderSync() {
  const { busy, recoveryError } = useDataStatus();
  const { reminderHour, reminderLeadDays } = useSettingsStore();
  const hideAmounts = useDevicePrivacy(state => state.hideAmounts);
  const { subscriptions, remindersEnabled } = useSubscriptionStore();
  const ready = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [now, setNow] = useState(() => new Date());
  const [foreground, setForeground] = useState(0);
  const day = localDateKey(now);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setNow(new Date()); setForeground(count => count + 1); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  useEffect(() => { if (ready && !busy && !recoveryError) void syncSubscriptionReminders(subscriptions, remindersEnabled).catch(() => console.warn('Could not synchronize subscription reminders')); }, [ready, busy, recoveryError, subscriptions, remindersEnabled, day, foreground, reminderHour, reminderLeadDays, hideAmounts]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    function openReview(response: Notifications.NotificationResponse) {
      if (response.notification.request.content.data?.kind === 'subscription-review') { router.navigate('/subscriptions'); Notifications.clearLastNotificationResponse(); }
    }
    const previous = Notifications.getLastNotificationResponse(); if (previous) openReview(previous);
    const listener = Notifications.addNotificationResponseReceivedListener(openReview); return () => listener.remove();
  }, []);
  return null;
}
