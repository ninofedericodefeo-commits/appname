import { useSettingsStore } from '@/stores/settingsStore';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform, Switch, Text, View } from 'react-native';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { getSubscriptionReminderStatus, requestSubscriptionReminderPermission, syncSubscriptionReminders } from './reminders';
import { describeReminderStatus } from './reminderStatus';
import type { ReminderStatus } from './reminderStatus';
import SubscriptionButton from './SubscriptionButton';
import SampleDataControl from '@/features/samples/SampleDataControl';

export default function SubscriptionSettingsPanel() {
  useThemeRevision();
  const { reminderHour, reminderLeadDays, configure } = useSettingsStore();
  const [timeOpen,setTimeOpen] = useState(false);
  const { subscriptions, remindersEnabled, setRemindersEnabled } = useSubscriptionStore();
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
  }, [ready, subscriptions, remindersEnabled, refresh, invalidate, reminderHour, reminderLeadDays]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); }); return () => { invalidate(); listener.remove(); }; }, [refresh, invalidate]);
  async function toggle(enabled: boolean) {
    if (!ready || changing.current) return;
    changing.current = true; setBusy(true); setMessage('');
    try {
      if (!enabled) { setRemindersEnabled(false); await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, false); }
      else if (await requestSubscriptionReminderPermission()) { await syncSubscriptionReminders(useSubscriptionStore.getState().subscriptions, true); setRemindersEnabled(true); }
      else setMessage('Notifications are off. You can still review renewals inside Centsward.');
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
    <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Phone reminders</Text>
      <View style={styles.row}><Text style={styles.label}>Subscription reminders</Text><Switch accessibilityLabel="Phone reminders for subscriptions" value={remindersEnabled} disabled={!ready || busy || Platform.OS === 'web'} onValueChange={value => void toggle(value)} trackColor={{ true: colors.primary, false: colors.lineStrong }} /></View>
      <Text style={styles.note}>At {new Date(2026,0,1,reminderHour).toLocaleTimeString(undefined,{ hour: 'numeric', minute: '2-digit' })}, {reminderLeadDays === 0 ? 'on renewal day' : `${reminderLeadDays} day${reminderLeadDays === 1 ? '' : 's'} before renewal`}, and on future cancellation follow-up dates. Due or overdue follow-ups remain in the app. Test samples never schedule phone notifications.</Text>
      <SubscriptionButton label={timeOpen ? 'Hide reminder timing' : 'Reminder time & lead'} accessibilityState={{ expanded: timeOpen }} onPress={() => setTimeOpen(!timeOpen)} />{timeOpen && <><Text style={styles.note}>Preferences save immediately. Phone permission and delivery status are separate below.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[0,1,2,3,7].map(days => <SubscriptionButton key={days} label={days === 0 ? 'Renewal day' : `${days} day${days === 1 ? '' : 's'} before`} accessibilityState={{ selected: reminderLeadDays === days }} tone={reminderLeadDays === days ? 'primary' : 'secondary'} onPress={() => configure({ reminderLeadDays: days })} />)}</View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Array.from({ length: 24 },(_,hour) => hour).map(hour => <SubscriptionButton key={hour} label={new Date(2026,0,1,hour).toLocaleTimeString(undefined,{ hour: 'numeric' })} accessibilityState={{ selected: reminderHour === hour }} tone={reminderHour === hour ? 'primary' : 'secondary'} onPress={() => configure({ reminderHour: hour })} />)}</View></>}
      <Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'Updating reminders…' : description?.label ?? 'Checking phone reminders…'}</Text>
      {Platform.OS !== 'web' && <View style={styles.actions}>
        {status?.permission === 'denied' ? <SubscriptionButton grow disabled={busy} label="Open phone settings" onPress={() => { void Linking.openSettings().catch(() => setMessage('Open your phone settings and find Centsward → Notifications.')); }} />
          : status?.permission === 'undetermined' && <SubscriptionButton grow disabled={!ready || busy} label="Allow notifications" onPress={() => void toggle(true)} />}
        <SubscriptionButton grow disabled={!ready || busy} label="Refresh reminders" onPress={() => void retry()} />
      </View>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
    </View>
    <SampleDataControl />
  </>;
}
const styles = themedStyles(() => ({ card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, row: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { color: colors.ink, fontSize: 15, flex: 1 }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, status: { color: colors.ink, fontWeight: '700', fontSize: 13, lineHeight: 19 }, actions: { flexWrap: 'wrap', flexDirection: 'row', gap: 8 } }));
