import AccessibilityBridge from '@/features/accessibility/AccessibilityBridge';
import { StatusBar } from 'expo-status-bar';
import { isDarkTheme , themedStyles, useThemeRevision , colors } from '@/theme';
import DataCompletionNotice from '@/features/data/DataCompletionNotice';
import { PurchaseInboxNotice } from '@/features/goals/PurchaseInboxNotice';
import { BottomNoticeArea } from '@/features/notices/BottomNoticeArea';
import { configureBatchStorage } from '@/features/bank/batch';
import { draftStorage } from '@/features/drafts/storage';
import { saveDraft } from '@/features/drafts/persistence';
import AppearanceBridge from '@/features/preferences/AppearanceBridge';
import { useReducedMotion } from '@/components/useReducedMotion';
import { StatementReminderSync } from '@/features/bank/StatementReminder';
import { useDataStatus } from '@/features/data/operationStatus';
import { PrivacyGate } from '@/features/privacy/PrivacyGate';
import { DataGate } from '@/features/data/DataGate';
import { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { syncGoalWidget } from '@/features/goals/widget';
import { SettingsButton } from '@/components/SettingsButton';
import { SubscriptionCancellationNotice } from '@/features/subscriptions/CancelSubscriptionButton';
import SubscriptionReminderSync from '@/features/subscriptions/SubscriptionReminderSync';
import { syncAccountWidget, endRetiredPurchaseActivities } from '@/features/spending/widgets';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { queryClient } from '@/lib/queryClient';
import { usePocketStore } from '@/stores/pocketStore';

configureBatchStorage({ read: draftStorage.read, save: saveDraft });

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
  useThemeRevision();
  // Keep this provider mounted while storage recovers or privacy covers the app.
  // Router's native provider measures asynchronously; seed the first frame so a
  // cold launch already knows the status bar / Dynamic Island exclusion area.
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><AppearanceBridge /><AccessibilityBridge /><DataGate><PrivacyGate><ReadyLayout /></PrivacyGate></DataGate></SafeAreaProvider>;
}

function ReadyLayout() {
  useThemeRevision();
  const { busy } = useDataStatus();
  const reduced = useReducedMotion();
  useEffect(() => {
    const refresh = () => { void syncAccountWidget().catch(error => console.warn('Could not update account widget', error)); };
    const retire = () => { void endRetiredPurchaseActivities().catch(error => console.warn('Could not dismiss retired purchase activity', error)); };
    const unsubscribers = [usePocketStore.subscribe(refresh), useWidgetSettingsStore.subscribe(refresh),
      usePocketStore.persist.onFinishHydration(refresh), useWidgetSettingsStore.persist.onFinishHydration(() => { refresh(); retire(); })];
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); retire(); } });
    refresh(); retire();
    return () => { unsubscribers.forEach(unsubscribe => unsubscribe()); foreground.remove(); };
  }, [busy]);
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
  }, [busy]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.appShell}><StatusBar style={isDarkTheme() ? 'light' : 'dark'} animated={!reduced} />
        <Stack screenOptions={{
          title: 'Tally',
          animation: reduced ? 'none' : 'default',
          headerRight: () => <SettingsButton />,
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="spending" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="activity" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="settings/index" options={{ headerRight: () => null }} />
          <Stack.Screen name="settings/[section]" options={{ headerRight: () => null, headerBackTitle: 'Settings' }} />
        </Stack>
        <BottomNoticeArea><PurchaseInboxNotice /><SubscriptionCancellationNotice /><DataCompletionNotice /></BottomNoticeArea>
      </View>
      <SubscriptionReminderSync /><StatementReminderSync />
    </QueryClientProvider>
  );
}

const styles = themedStyles(() => ({ appShell: { flex: 1, backgroundColor: colors.paper } }));
