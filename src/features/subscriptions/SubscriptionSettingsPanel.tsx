import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { colors } from '@/theme';
import { getSubscriptionReminderStatus, requestSubscriptionReminderPermission, syncSubscriptionReminders } from './reminders';
import { describeReminderStatus } from './reminderStatus';
import type { ReminderStatus } from './reminderStatus';
import SubscriptionButton from './SubscriptionButton';

export default function SubscriptionSettingsPanel() {
  const { subscriptions, remindersEnabled, setRemindersEnabled, resetSamples, removeSamples, sampleMode, setSampleMode } = useSubscriptionStore();
  const ready = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const request = useRef(0);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    const id = ++request.current;
    const live = useSubscriptionStore.getState();
    try { const result = await getSubscriptionReminderStatus(live.subscriptions, live.remindersEnabled); if (id === request.current) setStatus(result); }
    catch { if (id === request.current) { setStatus(null); setMessage('Could not check phone permissions and scheduled reminders. Try Refresh.'); } }
  }, []);
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { let canceled = false; if (ready) void Promise.resolve().then(() => { if (!canceled) return refresh(); });
    return () => { canceled = true; invalidate(); };
  }, [ready, subscriptions, remindersEnabled, refresh, invalidate]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); }); return () => { invalidate(); listener.remove(); }; }, [refresh, invalidate]);
  async function toggle(enabled: boolean) {
    if (!ready || changing.current) return;
    changing.current = true; setBusy(true); setMessage('');
    try {
      if (!enabled) { setRemindersEnabled(false); await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, false); }
      else if (await requestSubscriptionReminderPermission()) { await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, true); setRemindersEnabled(true); }
      else setMessage('Notifications are off. You can still review renewals inside GasFinder.');
      await refresh();
    } catch { setMessage(enabled ? 'Could not schedule reminders. Try Refresh.' : 'Could not clear reminders. Try Refresh.'); await refresh(); }
    finally { changing.current = false; setBusy(false); }
  }
  async function retry() {
    if (!ready || changing.current) return;
    changing.current = true; setBusy(true); setMessage('');
    try { const live = useSubscriptionStore.getState(); await syncSubscriptionReminders(live.subscriptions, live.remindersEnabled); await refresh(); }
    catch { setMessage('Could not update reminders. Check your phone settings and try again.'); await refresh(); }
    finally { changing.current = false; setBusy(false); }
  }
  const description = status ? describeReminderStatus(remindersEnabled, status) : null;
  return <>
    <View style={styles.card}><Text style={styles.heading}>Phone reminders</Text>
      <View style={styles.row}><Text style={styles.label}>Subscription reminders</Text><Switch accessibilityLabel="Phone reminders for subscriptions" value={remindersEnabled} disabled={!ready || busy || Platform.OS === 'web'} onValueChange={value => void toggle(value)} trackColor={{ true: colors.primary, false: colors.lineStrong }} /></View>
      <Text style={styles.note}>At 9 AM the day before a real renewal and on a future cancellation follow-up date. Due or overdue follow-ups remain in the app. Test samples never schedule phone notifications.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'Updating reminders…' : description?.label ?? 'Checking phone reminders…'}</Text>
      {Platform.OS !== 'web' && <View style={styles.actions}>
        {status?.permission === 'denied' ? <SubscriptionButton grow disabled={busy} label="Open phone settings" onPress={() => { void Linking.openSettings().catch(() => setMessage('Open your phone settings and find GasFinder → Notifications.')); }} />
          : status?.permission === 'undetermined' && <SubscriptionButton grow disabled={!ready || busy} label="Allow notifications" onPress={() => void toggle(true)} />}
        <SubscriptionButton grow disabled={!ready || busy} label="Refresh reminders" onPress={() => void retry()} />
      </View>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
    </View>
    <View style={styles.card}><Text style={styles.heading}>Test subscriptions</Text>
      <View style={styles.row}><Text style={styles.label}>Show sample subscriptions</Text><Switch accessibilityLabel="Test subscriptions mode" disabled={!ready} value={sampleMode} onValueChange={setSampleMode} trackColor={{ true: colors.primary, false: colors.lineStrong }} /></View>
      <Text style={styles.note}>Invented services for testing in-app reviews. Turning this off hides their test cards and renewals. Cost totals always exclude samples. Your real subscriptions and balance stay the same.</Text>
      <View style={styles.actions}><SubscriptionButton grow disabled={!ready} label={subscriptions.some(item => item.isSample) ? 'Reset samples' : 'Add samples'} onPress={resetSamples} />{subscriptions.some(item => item.isSample) && <SubscriptionButton grow disabled={!ready} label="Remove samples" onPress={removeSamples} />}</View>
      <Text style={styles.note}>Resetting turns on test mode and makes Music Plus renew tomorrow.</Text>
    </View>
  </>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { color: colors.ink, fontSize: 15, flex: 1 }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, status: { color: colors.ink, fontWeight: '700', fontSize: 13, lineHeight: 19 }, actions: { flexDirection: 'row', gap: 8 } });
