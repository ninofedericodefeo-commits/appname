import { useThemeRevision } from '@/theme';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarDateField } from '@/components/CalendarDateField';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { localDateKey } from './logic';
import type { Subscription } from './logic';
import SubscriptionButton from './SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
export default function CancellationControls({ subscription, managing }: { subscription: Subscription; managing: boolean }) {
  useThemeRevision();
  const [confirm, setConfirm] = useState(false), [date, setDate] = useState(localDateKey(new Date())), [error, setError] = useState('');
  const { setActive, setCancelBy, review } = useSubscriptionStore();
  if (!subscription.active) return <Text style={s.note}>Canceled on {subscription.canceledAt ? new Date(subscription.canceledAt).toLocaleDateString() : 'an earlier date'}. Reactivate only if you resubscribed with the provider.</Text>;
  return <View style={{ gap: 9 }}>
    {subscription.cancelBy && <><Text style={subscription.cancelBy <= localDateKey(new Date()) ? s.danger : s.note}>Cancellation follow-up {subscription.cancelBy <= localDateKey(new Date()) ? 'due' : 'by'} {subscription.cancelBy}. This subscription remains active until you confirm cancellation.</Text>{managing && <><CalendarDateField label="Cancellation follow-up date" value={subscription.cancelBy} onChange={value => setCancelBy(subscription.id, value)} /><SubscriptionButton label="I decided to keep it" onPress={() => review(subscription.id, subscription.lastReview?.renewalDate ?? localDateKey(new Date()), 'keep')} /></>}</>}
    {(managing || subscription.cancelBy) && (confirm ? <View style={s.card}><Text style={s.body}>When did you complete cancellation?</Text><CalendarDateField label="Cancellation completed on" maximumDate={localDateKey(new Date())} value={date} onChange={setDate} /><View style={s.row}><SubscriptionButton label="Confirm I canceled it" tone="primary" grow onPress={() => { try { setActive(subscription.id, false, date); setConfirm(false); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the cancellation date.'); } }} /><SubscriptionButton label="Keep active" grow onPress={() => setConfirm(false)} /></View></View> : <SubscriptionButton label="I canceled it" onPress={() => setConfirm(true)} />)}
    {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}
  </View>;
}
