import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { CalendarDateField, localDateKey } from '@/components/CalendarDateField';
import { formatAmount } from '@/lib/money';
import { parseDollars } from '@/features/pocket/logic';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { colors } from '@/theme';
import { subscriptionCategories } from './logic';
import type { Subscription } from './logic';
import { billingChannels, billingDestination } from './billing';
import type { BillingChannel } from './billing';
import type { SubscriptionApp } from './providerApps';
import type { BankSubscriptionSuggestion } from './bankSuggestions';
import InstalledAppPicker from './InstalledAppPicker';
import SubscriptionButton from './SubscriptionButton';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SubscriptionEditor({ subscription, suggestion, onClose }: { subscription?: Subscription;
  suggestion?: BankSubscriptionSuggestion; onClose: () => void }) {
  const ready = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const source = subscription ?? suggestion;
  const [name, setName] = useState(source?.name ?? '');
  const [amount, setAmount] = useState(source ? formatAmount(source.amountCents) : '');
  const [cadence, setCadence] = useState<Subscription['cadence']>(source?.cadence ?? 'monthly');
  const [day, setDay] = useState(source?.day ?? 1);
  const [month, setMonth] = useState(source?.month ?? 1);
  const [app, setApp] = useState<SubscriptionApp | undefined>(subscription?.associatedApp);
  const [billingChannel, setBillingChannel] = useState<BillingChannel>(subscription?.billingChannel ?? 'unknown');
  const [category, setCategory] = useState(subscription?.category ?? 'Other');
  const [trialEndsOn, setTrialEndsOn] = useState(subscription?.trialEndsOn ?? '');
  const [extra, setExtra] = useState(!!subscription?.trialEndsOn);
  const [error, setError] = useState('');
  const calendarMonth = cadence === 'yearly' ? month : day === 31 ? 1 : 3;
  let year = new Date().getFullYear();
  if (calendarMonth === 2 && day === 29) while (new Date(year, 1, 29).getMonth() !== 1) year++;
  const date = localDateKey(new Date(year, calendarMonth - 1, day, 12));
  function save() {
    if (!ready) return;
    const amountCents = parseDollars(amount);
    if (!name.trim()) return setError('Enter the subscription name.');
    if (amountCents === null || amountCents <= 0 || amountCents > 100_000_000) return setError('Enter a price greater than $0, with no more than two decimal places.');
    try { useSubscriptionStore.getState().saveSubscription({ name: name.trim(), amountCents, cadence, day, month, associatedApp: app, billingChannel, category, trialEndsOn: trialEndsOn || undefined,
      ...(suggestion ? { bankMerchantKey: suggestion.merchantKey } : {}) }, subscription?.id);
    onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the subscription.'); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Text style={styles.title}>{subscription ? 'Edit subscription' : 'Add subscription'}</Text><SubscriptionButton label="Close" onPress={onClose} /></View>
      <FormScrollView contentContainerStyle={styles.form}>
        {suggestion && <Text style={styles.note}>From bank history. Confirm the estimated price and renewal date before saving.</Text>}
        <View style={styles.field}><Text style={styles.label}>Subscription name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Spotify" accessibilityLabel="Subscription name" maxLength={80} /></View>
        <View style={styles.field}><Text style={styles.label}>Renewal price</Text><TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" accessibilityLabel="Renewal price" keyboardType="decimal-pad" /></View>
        <View style={styles.field}><Text style={styles.label}>Renews</Text><View style={styles.row}>{(['monthly', 'yearly'] as const).map(value => <SubscriptionButton key={value} label={value === 'monthly' ? 'Monthly' : 'Yearly'} grow tone={cadence === value ? 'primary' : 'secondary'} accessibilityState={{ selected: cadence === value }} onPress={() => setCadence(value)} />)}</View></View>
        <View><CalendarDateField label="Renewal date" value={date} displayValue={cadence === 'monthly' ? `Day ${day} of each month` : `${months[month - 1]} ${day} each year`} onChange={value => { const [, m, d] = value.split('-').map(Number); setDay(d); setMonth(m); }} /><Text style={styles.note}>In shorter months, renewal falls on the last day.</Text></View>
        <View style={styles.field}><Text style={styles.label}>Who bills you?</Text><View style={[styles.row, { flexWrap: 'wrap' }]}>{billingChannels.map(channel => <SubscriptionButton key={channel.id} label={channel.label} tone={billingChannel === channel.id ? 'primary' : 'secondary'} accessibilityState={{ selected: billingChannel === channel.id }} onPress={() => setBillingChannel(channel.id)} />)}</View><Text style={styles.note}>Check your receipt if unsure. This chooses where Plan to cancel opens.</Text></View>
        <InstalledAppPicker selected={app} onSelect={setApp} />
        {billingChannel === 'website' && <Text style={styles.note}>{billingDestination({ name, associatedApp: app, billingChannel } as Subscription, 'web')?.instructions ?? 'Choose the associated provider app to use its account website. You can also cancel manually with the provider.'}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: extra }} onPress={() => setExtra(!extra)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.label}>{extra ? 'Hide category & trial details' : 'Category & free trial'}</Text></Pressable>
        {extra && <View style={styles.field}><Text style={styles.label}>Category</Text><View style={[styles.row, { flexWrap: 'wrap' }]}>{subscriptionCategories.map(value => <SubscriptionButton key={value} label={value} tone={category === value ? 'primary' : 'secondary'} onPress={() => setCategory(value)} />)}</View><Text style={styles.label}>Trial end / first paid renewal · optional</Text><CalendarDateField label="Trial end date" value={trialEndsOn} onChange={value => { setTrialEndsOn(value); const [, m, d] = value.split('-').map(Number); setDay(d); setMonth(m); }} /><Text style={styles.note}>The renewal price is the expected paid price after the trial. Confirm this date with the provider.</Text>{!!trialEndsOn && <SubscriptionButton label="Remove trial date" onPress={() => setTrialEndsOn('')} />}</View>}
        {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        <View style={styles.row}><SubscriptionButton label="Cancel" grow onPress={onClose} /><SubscriptionButton label={subscription ? 'Save changes' : 'Add subscription'} tone="primary" grow disabled={!ready} onPress={save} /></View>
      </FormScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderColor: colors.line },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', flex: 1 }, form: { padding: 20, gap: 22, paddingBottom: 40 }, field: { gap: 8 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' }, input: { color: colors.ink, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 12, fontSize: 16, backgroundColor: colors.surface },
  row: { flexDirection: 'row', gap: 8 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, error: { color: colors.danger, fontSize: 13 },
});
