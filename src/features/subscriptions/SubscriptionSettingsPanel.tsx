import { useRef, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { colors } from '@/theme';
import { requestSubscriptionReminderPermission, syncSubscriptionReminders } from './reminders';
import SubscriptionButton from './SubscriptionButton';

export default function SubscriptionSettingsPanel() {
  const { subscriptions, remindersEnabled, setRemindersEnabled, resetSamples, removeSamples } = useSubscriptionStore();
  const ready = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const [message, setMessage] = useState('');
  async function toggle(enabled: boolean) {
    if (!ready || changing.current) return;
    changing.current = true; setBusy(true); setMessage('');
    try {
      if (!enabled) {
        setRemindersEnabled(false);
        await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, false);
      } else if (await requestSubscriptionReminderPermission()) {
        await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, true);
        setRemindersEnabled(true);
      } else setMessage('Notifications are off. You can still review renewals inside GasFinder.');
    } catch { setMessage(enabled ? 'Could not schedule reminders. Try again.' : 'Could not clear reminders. Check your phone’s notification settings.'); }
    finally { changing.current = false; setBusy(false); }
  }
  return <>
    <View style={styles.card}>
      <Text style={styles.heading}>Phone reminders</Text>
      <View style={styles.row}><Text style={styles.label}>Subscription renewals</Text><Switch accessibilityLabel="Phone reminders for subscription renewals" value={remindersEnabled} disabled={!ready || busy || Platform.OS === 'web'} onValueChange={value => void toggle(value)} trackColor={{ true: colors.primary, false: colors.lineStrong }} /></View>
      <Text style={styles.note}>One notification at 9 AM the day before a renewal. In-app reviews are always available.</Text>
      {Platform.OS === 'web' && <Text style={styles.note}>Turn on phone reminders in GasFinder on your phone.</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Sample subscriptions</Text><Text style={styles.note}>Invented services and prices for testing. Resetting makes Music Plus renew tomorrow. They do not affect your balance.</Text>
      <View style={styles.actions}><SubscriptionButton grow disabled={!ready} label={subscriptions.some(item => item.isSample) ? 'Reset samples' : 'Add samples'} onPress={resetSamples} />{subscriptions.some(item => item.isSample) && <SubscriptionButton grow disabled={!ready} label="Remove samples" onPress={removeSamples} />}</View>
    </View>
  </>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { color: colors.ink, fontSize: 15, flex: 1 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, actions: { flexDirection: 'row', gap: 8 },
});
