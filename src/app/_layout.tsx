import { colors } from '@/theme';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';

import { syncGoalWidget } from '@/features/goals/widget';
import { SettingsButton } from '@/components/SettingsButton';
import { SubscriptionCancellationNotice } from '@/features/subscriptions/CancelSubscriptionButton';
import SubscriptionReminderSync from '@/features/subscriptions/SubscriptionReminderSync';
import { syncAccountWidget, endRetiredPurchaseActivities } from '@/features/spending/widgets';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { queryClient } from '@/lib/queryClient';
import { usePocketStore } from '@/stores/pocketStore';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  useEffect(() => {
    const refresh = () => { void syncAccountWidget().catch(error => console.warn('Could not update account widget', error)); };
    const retire = () => { void endRetiredPurchaseActivities().catch(error => console.warn('Could not dismiss retired purchase activity', error)); };
    const unsubscribers = [usePocketStore.subscribe(refresh), useWidgetSettingsStore.subscribe(refresh),
      usePocketStore.persist.onFinishHydration(refresh), useWidgetSettingsStore.persist.onFinishHydration(() => { refresh(); retire(); })];
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); retire(); } });
    refresh(); retire();
    return () => { unsubscribers.forEach(unsubscribe => unsubscribe()); foreground.remove(); };
  }, []);
  useEffect(() => {
    const refresh = () => {
      const state = usePocketStore.getState();
      void syncGoalWidget(state.activeGoal, state.goalSettings).catch((error) => console.warn('Could not refresh goal widget', error));
    };
    const unsubscribe = usePocketStore.subscribe(refresh);
    const hydration = usePocketStore.persist.onFinishHydration(refresh);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    if (usePocketStore.persist.hasHydrated()) refresh();
    return () => { unsubscribe(); hydration(); foreground.remove(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.appShell}>
        <Stack screenOptions={{
          headerTitle: '',
          headerRight: () => <SettingsButton />,
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="spending" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="activity" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="settings" options={{ headerRight: () => null }} />
        </Stack>
        <SubscriptionCancellationNotice />
      </View>
      <SubscriptionReminderSync />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({ appShell: { flex: 1, backgroundColor: colors.paper } });
