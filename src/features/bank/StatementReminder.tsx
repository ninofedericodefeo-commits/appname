import { useThemeRevision } from '@/theme';
import { latestStatementDay } from './coverage';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Link, router } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePocketStore } from '@/stores/pocketStore';
import { useDataStatus } from '../data/operationStatus';
import { requestSubscriptionReminderPermission } from '../subscriptions/reminders';
import { listBankImports } from './importArchive';
import { dataStyles as s } from '../data/styles';
let queue: Promise<unknown> = Promise.resolve();
export function StatementReminderSync() {
  useThemeRevision();
  const { statementReminderDays } = useSettingsStore(), { balanceUpdatedAt, linkedBankAccount } = usePocketStore(), { busy, revision } = useDataStatus();
  const [foreground,setForeground] = useState(0);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state === 'active') setForeground(value => value + 1); }); return () => listener.remove(); }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || busy) return;
    let canceled = false;
    queue = queue.catch(() => undefined).then(async () => {
      const files = await listBankImports(true), relevant = files.filter(file => linkedBankAccount?.aliases.includes(file.accountLabel));
      const last = latestStatementDay(relevant);
      const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter(item => item.content.data?.kind === 'statement-reminder');
      if (canceled) return;
      if (!statementReminderDays || !last) { for (const item of existing) await Notifications.cancelScheduledNotificationAsync(item.identifier); return; }
      const signature = `${linkedBankAccount?.id}:${last}:${statementReminderDays}`;
      if (existing.length === 1 && existing[0].content.data?.signature === signature) return;
      for (const item of existing) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      const permission = await Notifications.getPermissionsAsync();
      if (!(permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL)) return;
      const due = new Date(`${last}T09:00:00`); due.setDate(due.getDate() + statementReminderDays);
      if (due.getTime() <= Date.now()) { due.setTime(Date.now()); due.setDate(due.getDate()+1); due.setHours(9,0,0,0); }
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('statements', { name: 'Bank statements', importance: Notifications.AndroidImportance.DEFAULT });
      await Notifications.scheduleNotificationAsync({ content: { title: 'Time to check your bank statement', body: 'Download and share a statement if one is available. Tally cannot check Citizens for you.', data: { kind: 'statement-reminder', signature } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, ...(Platform.OS === 'android' ? { channelId: 'statements' } : {}) } });
    }).catch(() => console.warn('Could not schedule statement reminder'));
    return () => { canceled = true; };
  }, [statementReminderDays, balanceUpdatedAt, linkedBankAccount, busy, revision, foreground]);
  useEffect(() => { if (Platform.OS === 'web') return; const open = (response: Notifications.NotificationResponse) => { if (response.notification.request.content.data?.kind === 'statement-reminder') { router.navigate('/statement-automation'); Notifications.clearLastNotificationResponse(); } }; const previous = Notifications.getLastNotificationResponse(); if (previous) open(previous); const listener = Notifications.addNotificationResponseReceivedListener(open); return () => listener.remove(); }, []);
  return null;
}
export default function StatementReminderSettings() {
  useThemeRevision();
  const { statementReminderDays, setStatementReminderDays } = useSettingsStore(), [message,setMessage] = useState('');
  const [last,setLast] = useState(''), pocket = usePocketStore();
  useEffect(() => { void listBankImports(true).then(files => setLast(latestStatementDay(files.filter(file => pocket.linkedBankAccount?.aliases.includes(file.accountLabel))) ?? '')).catch(() => setMessage('Could not read saved statement coverage.')); }, [pocket.linkedBankAccount]);
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Statement reminder</Text><Text style={s.note}>Latest saved statement through {last || 'unknown'}. Newer activity may be missing after that date. Choose a cadence to check for another statement; this does not detect a newly issued PDF.</Text><View style={s.row}>{[0,30,45,60,90].map(days => <Pressable key={days} accessibilityRole="button" accessibilityState={{ selected: days === statementReminderDays }} style={[s.choice,days === statementReminderDays && s.selected]} onPress={() => void (async () => { if (days && Platform.OS === 'web') { setMessage('Phone reminders require the native app.'); return; } if (days && !await requestSubscriptionReminderPermission()) { setMessage('Allow notifications in phone Settings to receive reminders.'); return; } setStatementReminderDays(days); setMessage(days ? 'Cadence saved. A reminder is scheduled from the last statement date when available.' : 'Statement reminder turned off.'); })().catch(() => setMessage('Could not change reminder settings.'))}><Text style={s.choiceText}>{days ? `${days} days` : 'Off'}</Text></Pressable>)}</View><Link href="/statement-automation" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Statement shortcut & download instructions ›</Text></Pressable></Link>{!!message && <Text style={s.note}>{message}</Text>}</View>;
}
