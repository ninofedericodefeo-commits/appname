import { useAmountsHidden } from '@/features/preferences/amountVisibility';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { formatMoney } from '@/lib/money';
import { pendingRenewalReviews } from './reviewPreferences';
import SubscriptionButton from './SubscriptionButton';

export default function RenewalBanner() {
  useThemeRevision();
  const amountsHidden = useAmountsHidden();
  const { subscriptions, sampleMode, reviewSnoozes, snoozeReviews } = useSubscriptionStore();
  const ready = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setNow(new Date()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const due = ready ? pendingRenewalReviews(subscriptions, sampleMode, reviewSnoozes, now) : [];
  if (!due.length || pathname === '/subscriptions') return null;
  return <View style={styles.banner}>
    <Text accessibilityRole="header" style={styles.title}>{due.length} renewal{due.length === 1 ? '' : 's'} tomorrow{!amountsHidden && ` · ${formatMoney(due.reduce((total, item) => total + item.subscription.amountCents, 0))}`}</Text>
    {due.some(item => item.subscription.isSample) && <Text style={styles.note}>Test subscriptions included</Text>}
    <View style={styles.actions}><SubscriptionButton label="Review" accessibilityLabel="Review tomorrow’s subscriptions" tone="primary" grow onPress={() => router.navigate('/subscriptions')} /><SubscriptionButton label="Later · 2h" accessibilityLabel="Snooze renewal reviews for two hours" grow onPress={() => snoozeReviews('two-hours')} /></View>
  </View>;
}
const styles = themedStyles(() => ({ banner: { marginHorizontal: 20, marginBottom: 8, padding: 12, backgroundColor: colors.paleOrange, borderRadius: 12, gap: 8 }, title: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' }, note: { color: colors.muted, fontSize: 11 }, actions: { flexWrap: 'wrap', flexDirection: 'row', gap: 8 } }));
