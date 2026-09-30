import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDateKey, subscriptionsToReviewTomorrow } from '@/features/subscriptions/logic';
import { syncSubscriptionReminders } from '@/features/subscriptions/reminders';
import { syncGoalWidget } from '@/features/goals/widget';
import { queryClient } from '@/lib/queryClient';
import { usePocketStore } from '@/stores/pocketStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

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

function SubscriptionReviewPrompt() {
  const { subscriptions, remindersEnabled, review } = useSubscriptionStore();
  const hydrated = useSyncExternalStore(
    useSubscriptionStore.persist.onFinishHydration,
    useSubscriptionStore.persist.hasHydrated,
    () => false,
  );
  const [today, setToday] = useState(() => new Date());
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const todayKey = localDateKey(today);
  const due = hydrated ? subscriptionsToReviewTomorrow(subscriptions, today) : [];
  const totalCents = due.reduce((total, { subscription }) => total + subscription.amountCents, 0);

  useEffect(() => {
    const interval = setInterval(() => setToday(new Date()), 60_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(new Date());
        setDismissedDay(null);
        setRefreshCount((count) => count + 1);
      }
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void syncSubscriptionReminders(subscriptions, remindersEnabled).catch((error) => {
        console.warn('Could not schedule subscription reminders', error);
      });
    }
  }, [hydrated, subscriptions, remindersEnabled, todayKey, refreshCount]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    function openSubscriptionReview(response: Notifications.NotificationResponse) {
      if (response.notification.request.content.data?.kind === 'subscription-review') {
        router.push('/subscriptions');
        Notifications.clearLastNotificationResponse();
      }
    }
    const previous = Notifications.getLastNotificationResponse();
    if (previous) openSubscriptionReview(previous);
    const listener = Notifications.addNotificationResponseReceivedListener(openSubscriptionReview);
    return () => listener.remove();
  }, []);

  return (
    <Modal
      animationType="slide"
      visible={due.length > 0 && dismissedDay !== todayKey}
      onRequestClose={() => setDismissedDay(todayKey)}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>RENEWING TOMORROW</Text>
          <Text style={styles.title}>Still worth it?</Text>
          <Text style={styles.description}>
            Review each subscription before its next charge. These prices and dates are the details you entered.
          </Text>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{due.length} subscription{due.length === 1 ? '' : 's'} · estimated total</Text>
            <Text style={styles.summaryAmount}>${(totalCents / 100).toFixed(2)}</Text>
          </View>
          {due.map(({ subscription, renewal }) => (
            <View key={subscription.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.name}>{subscription.name}</Text>
                <Text style={styles.amount}>${(subscription.amountCents / 100).toFixed(2)}</Text>
              </View>
              <Text style={styles.meta}>Renews {renewal.toLocaleDateString()}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.keepButton}
                  onPress={() => review(subscription.id, localDateKey(renewal), 'keep')}
                >
                  <Text style={styles.keepText}>Keep it</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.cancelButton}
                  onPress={() => review(subscription.id, localDateKey(renewal), 'plan-to-cancel')}
                >
                  <Text style={styles.cancelText}>Plan to cancel</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Text style={styles.note}>Planning to cancel is a note to yourself. You still need to cancel with the subscription provider before its deadline.</Text>
          <Pressable accessibilityRole="button" style={styles.laterButton} onPress={() => setDismissedDay(todayKey)}>
            <Text style={styles.laterText}>Review later</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function RootLayout() {
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
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <SubscriptionReviewPrompt />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  content: { padding: 22, paddingBottom: 42, gap: 14 },
  eyebrow: { color: '#4f46e5', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  title: { color: '#111827', fontSize: 32, fontWeight: '800' },
  description: { color: '#475569', fontSize: 15, lineHeight: 22 },
  summary: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: 18, padding: 18 },
  summaryLabel: { color: '#4338ca', fontSize: 13, fontWeight: '700' },
  summaryAmount: { color: '#312e81', fontSize: 32, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderColor: '#e7ebf0', borderWidth: 1, borderRadius: 18, padding: 17 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  name: { color: '#111827', fontSize: 18, fontWeight: '800', flex: 1 },
  amount: { color: '#111827', fontSize: 18, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 13, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  keepButton: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 12, flex: 1, alignItems: 'center' },
  keepText: { color: '#ffffff', fontWeight: '700' },
  cancelButton: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, flex: 1, alignItems: 'center' },
  cancelText: { color: '#334155', fontWeight: '700' },
  note: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  laterButton: { alignSelf: 'center', padding: 12 },
  laterText: { color: '#475569', fontWeight: '700' },
});
