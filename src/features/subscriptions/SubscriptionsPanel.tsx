import { formatAmount, formatMoney } from '@/lib/money';
import { parseDollars } from '@/features/pocket/logic';
import { colors } from '@/theme';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'expo-router';
import { usePocketStore } from '@/stores/pocketStore';
import { suggestBankSubscriptions } from './bankSuggestions';
import type { BankSubscriptionSuggestion } from './bankSuggestions';
import { AppState, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CalendarDateField, localDateKey as calendarDateKey } from '@/components/CalendarDateField';
import { localDateKey, nextRenewal, subscriptionsToReviewTomorrow } from '@/features/subscriptions/logic';
import type { Subscription } from '@/features/subscriptions/logic';
import { requestSubscriptionReminderPermission, syncSubscriptionReminders } from '@/features/subscriptions/reminders';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { SUBSCRIPTION_APPS, subscriptionApp } from './providerApps';
import CancelSubscriptionButton from './CancelSubscriptionButton';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function nextLeapYear(start: number) { let year = start; while (new Date(year, 1, 29).getMonth() !== 1) year++; return year; }

export default function SubscriptionsPanel() {
  const { subscriptions, remindersEnabled, setRemindersEnabled, saveSubscription, setActive, review, removeSubscription, dismissedBankSuggestions, dismissBankSuggestion, restoreBankSuggestions, resetSamples, removeSamples } = useSubscriptionStore();
  const purchases = usePocketStore((state) => state.purchases);
  const pocketReady = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const subsReady = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [today, setToday] = useState(() => new Date());
  const [bankSuggestion, setBankSuggestion] = useState<BankSubscriptionSuggestion | null>(null);
  const [suggestionLimit, setSuggestionLimit] = useState(5);
  const suggestions = useMemo(() => pocketReady && subsReady ? suggestBankSubscriptions(purchases, subscriptions, dismissedBankSuggestions, today) : [], [purchases, subscriptions, dismissedBankSuggestions, today, pocketReady, subsReady]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [hasApp, setHasApp] = useState(false);
  const [appName, setAppName] = useState('');
  const [appURL, setAppURL] = useState('');
  const [fallbackURL, setFallbackURL] = useState('');
  const [cadence, setCadence] = useState<Subscription['cadence']>('monthly');
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const selectedDay = Number(day);
  const calendarYear = month === 2 && selectedDay === 29 ? nextLeapYear(new Date().getFullYear()) : new Date().getFullYear();
  const calendarMonth = cadence === 'yearly' ? month : (selectedDay === 31 ? 1 : 3);
  const recurrenceDate = calendarDateKey(new Date(calendarYear, calendarMonth - 1, Number.isInteger(selectedDay) && selectedDay >= 1 && selectedDay <= 31 ? selectedDay : 1, 12));
  const due = subscriptionsToReviewTomorrow(subscriptions, today);
  const active = subscriptions.filter((subscription) => subscription.active)
    .sort((a, b) => nextRenewal(a, today).getTime() - nextRenewal(b, today).getTime());
  const inactive = subscriptions.filter((subscription) => !subscription.active);

  useEffect(() => {
    const interval = setInterval(() => setToday(new Date()), 60_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(new Date());
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, []);

  function resetForm() {
    setName('');
    setAmount('');
    setHasApp(false); setAppName(''); setAppURL(''); setFallbackURL('');
    setCadence('monthly');
    setDay('1');
    setMonth(1);
    setEditingId(null);
    setBankSuggestion(null);
    setShowForm(false);
    setError('');
  }

  function save() {
    if (!subsReady) return;
    const trimmedName = name.trim();
    const amountCents = parseDollars(amount) ?? NaN;
    const billingDay = Number(day);
    if (!trimmedName) return setError('Enter the subscription name.');
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
      return setError('Enter a price greater than $0, with no more than two decimal places.');
    }
    if (!/^\d+$/.test(day.trim()) || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
      return setError('Enter a renewal day from 1 to 31.');
    }
    let associatedApp;
    try { associatedApp = hasApp ? subscriptionApp({ name: appName, url: appURL, fallbackUrl: fallbackURL }) : undefined; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the app link.'); return; }
    saveSubscription({ name: trimmedName, amountCents, cadence, day: billingDay, month, associatedApp, ...(bankSuggestion ? { bankMerchantKey: bankSuggestion.merchantKey } : {}) }, editingId ?? undefined);
    resetForm();
  }

  function edit(subscription: Subscription) {
    setShowForm(true);
    setEditingId(subscription.id);
    setBankSuggestion(null);
    setName(subscription.name);
    setAmount(formatAmount(subscription.amountCents));
    setHasApp(!!subscription.associatedApp); setAppName(subscription.associatedApp?.name ?? '');
    setAppURL(subscription.associatedApp?.url ?? ''); setFallbackURL(subscription.associatedApp?.fallbackUrl ?? '');
    setCadence(subscription.cadence);
    setDay(String(subscription.day));
    setMonth(subscription.month);
    setError('');
  }

  async function toggleReminders() {
    setReminderMessage('');
    if (remindersEnabled) {
      setRemindersEnabled(false);
      try {
        await syncSubscriptionReminders(subscriptions, false);
      } catch {
        setReminderMessage('Could not clear scheduled reminders. Check notification settings on your phone.');
      }
      return;
    }
    try {
      if (!(await requestSubscriptionReminderPermission())) {
        setReminderMessage('Phone notifications are off. The in-app review still appears when you open GasFinder.');
        return;
      }
      await syncSubscriptionReminders(subscriptions, true);
      setRemindersEnabled(true);
    } catch {
      setReminderMessage('Could not schedule phone reminders. Try again later.');
    }
  }

  function subscriptionCard(subscription: Subscription) {
    const renewal = nextRenewal(subscription, today);
    const renewalKey = localDateKey(renewal);
    const decision = subscription.lastReview?.renewalDate === renewalKey ? subscription.lastReview.decision : null;
    return (
      <View key={subscription.id} style={styles.subscriptionCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.subscriptionName}>{subscription.name}</Text>
          <Text style={styles.subscriptionAmount}>{formatMoney(subscription.amountCents)}</Text>
        </View>
        {subscription.isSample && <Text style={styles.meta}>SAMPLE · invented service and price</Text>}
        {subscription.associatedApp && <Text style={styles.meta}>Associated app: {subscription.associatedApp.name}</Text>}
        <Text style={styles.meta}>
          {subscription.cadence === 'monthly' ? 'Monthly' : 'Yearly'} · next renewal {renewal.toLocaleDateString()}
        </Text>
        {decision && (
          <Text style={styles.decision}>
            {decision === 'keep' ? 'You chose to keep it for this renewal.' : 'You plan to cancel before this renewal. Cancel with the provider to stop the charge.'}
          </Text>
        )}
        {!subscription.active && <Text style={styles.decision}>Marked canceled in GasFinder. No more reminders are scheduled for it.</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => edit(subscription)}><Text style={styles.textButtonLabel}>Edit</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => setActive(subscription.id, !subscription.active)}>
            <Text style={styles.textButtonLabel}>{subscription.active ? 'I canceled it' : 'Reactivate'}</Text>
          </Pressable>
          {subscription.active && <CancelSubscriptionButton subscription={subscription} renewalDate={renewalKey} label={decision === 'plan-to-cancel' && subscription.associatedApp ? 'Open app to cancel' : 'Plan to cancel'} />}
          {removeId === subscription.id ? <View style={styles.inlineConfirmation}>
            <Text accessibilityLiveRegion="polite" style={styles.bodyText}>Delete this subscription?</Text>
            <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Confirm delete ${subscription.name}`} style={styles.textButton} onPress={() => { removeSubscription(subscription.id); if (editingId === subscription.id) resetForm(); setRemoveId(null); }}><Text style={styles.removeLabel}>Confirm delete</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Keep ${subscription.name}`} style={styles.textButton} onPress={() => setRemoveId(null)}><Text style={styles.textButtonLabel}>Keep it</Text></Pressable></View>
          </View> : <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${subscription.name}`} style={styles.textButton} onPress={() => setRemoveId(subscription.id)}><Text style={styles.removeLabel}>Delete</Text></Pressable>}
        </View>
      </View>
    );
  }

  const form = showForm ? (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{editingId ? 'Edit subscription' : 'Add a subscription'}</Text>
      {bankSuggestion && <Text style={styles.bodyText}>From bank history. Price and renewal date are estimates from posted charges. Confirm them with the provider before adding.</Text>}
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name, such as Music" accessibilityLabel="Subscription name" maxLength={80} />
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Renewal price in dollars" accessibilityLabel="Renewal price" keyboardType="decimal-pad" />
      <Text style={styles.fieldLabel}>Renews</Text>
      <View style={styles.actions}>
        {(['monthly', 'yearly'] as const).map((value) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: cadence === value }} style={[styles.choice, cadence === value && styles.choiceActive]} onPress={() => setCadence(value)}>
            <Text style={[styles.choiceLabel, cadence === value && styles.choiceActiveLabel]}>{value === 'monthly' ? 'Every month' : 'Every year'}</Text>
          </Pressable>
        ))}
      </View>
      <CalendarDateField key={`${editingId ?? 'new'}-${cadence}-${recurrenceDate}`} label="Renewal date" value={recurrenceDate} displayValue={cadence === 'monthly' ? `Day ${day} of each month` : `${monthNames[month - 1]} ${day} each year`} onChange={(date) => { const [, selectedMonth, selectedDate] = date.split('-').map(Number); setDay(String(selectedDate)); setMonth(selectedMonth); }} />
      <Text style={styles.smallNote}>For months without that day, the renewal is shown on the last day of the month.</Text>
      <Text style={styles.fieldLabel}>Is there an app associated with this subscription?</Text>
      <View style={styles.actions}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: hasApp === value }} style={[styles.choice, hasApp === value && styles.choiceActive]} onPress={() => setHasApp(value)}><Text style={[styles.choiceLabel, hasApp === value && styles.choiceActiveLabel]}>{value ? 'Yes' : 'No'}</Text></Pressable>)}</View>
      {hasApp && <>
        <View style={styles.actions}>{SUBSCRIPTION_APPS.map(app => <Pressable key={app.name} accessibilityRole="button" style={styles.choice} onPress={() => { setAppName(app.name); setAppURL(app.url); setFallbackURL(app.fallbackUrl ?? ''); }}><Text style={styles.choiceLabel}>{app.name}</Text></Pressable>)}</View>
        <TextInput value={appName} onChangeText={setAppName} accessibilityLabel="Associated app name" placeholder="App name, or another provider" maxLength={80} style={styles.input} />
        <TextInput value={appURL} onChangeText={setAppURL} accessibilityLabel="Associated app link" placeholder="App link or full HTTPS website" maxLength={2048} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
        <TextInput value={fallbackURL} onChangeText={setFallbackURL} accessibilityLabel="Provider fallback website" placeholder="HTTPS website if app cannot open · optional" maxLength={2048} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
        <Text style={styles.smallNote}>Plan to cancel opens this link. Supported links open the installed app; others open its website. You still complete cancellation with the provider.</Text>
      </>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" style={styles.saveButton} onPress={save}><Text style={styles.saveLabel}>{editingId ? 'Save changes' : 'Add subscription'}</Text></Pressable>
      {(editingId || bankSuggestion) && <Pressable accessibilityRole="button" style={styles.cancelEdit} onPress={resetForm}><Text style={styles.textButtonLabel}>Cancel</Text></Pressable>}
    </View>
  ) : null;

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Subscriptions & pause</Text>
      <Text style={styles.intro}>Review renewals and give new purchases time before you buy.</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Test subscriptions</Text>
        <Text style={styles.bodyText}>Invented subscriptions let you test review, cancellation and reminders. Music Plus renews tomorrow after resetting samples. These do not represent real charges or affect your balance.</Text>
        <View style={styles.actions}><Pressable accessibilityRole="button" style={styles.textButton} onPress={resetSamples}><Text style={styles.textButtonLabel}>{subscriptions.some(item => item.isSample) ? 'Reset samples' : 'Add sample subscriptions'}</Text></Pressable>
          {subscriptions.some(item => item.isSample) && <Pressable accessibilityRole="button" style={styles.textButton} onPress={removeSamples}><Text style={styles.removeLabel}>Remove samples</Text></Pressable>}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>From bank history ({suggestions.length})</Text>
        <Text style={styles.bodyText}>Import statements to find recurring charges. Review each suggestion before adding it.</Text>
        <Link href="/bank-import" style={styles.textButtonLabel}>Import bank PDF or CSV</Link>
        {(bankSuggestion ? suggestions.filter((suggestion) => suggestion.key === bankSuggestion.key) : suggestions.slice(0, suggestionLimit)).map((suggestion) => <View key={suggestion.key} style={styles.reviewRow}>
          <View style={styles.rowBetween}><Text style={styles.subscriptionName}>{suggestion.name}</Text><Text style={styles.subscriptionAmount}>{formatMoney(suggestion.amountCents)}</Text></View>
          <Text style={styles.meta}>{suggestion.confidence === 'repeated' ? `Repeats ${suggestion.cadence}` : 'Possible subscription · one charge'}</Text>
          <Text style={styles.smallNote}>{suggestion.evidence.map((charge) => `${new Date(charge.date).toLocaleDateString()}: ${formatMoney(charge.amountCents)}`).join(' · ')}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Review ${suggestion.name} suggestion`} style={styles.primaryButton} onPress={() => {
              resetForm(); setBankSuggestion(suggestion); setName(suggestion.name); setAmount(formatAmount(suggestion.amountCents));
              setCadence(suggestion.cadence); setDay(String(suggestion.day)); setMonth(suggestion.month); setShowForm(true);
            }}><Text style={styles.primaryLabel}>Review & add</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${suggestion.name} suggestion`} style={styles.secondaryButton} onPress={() => { dismissBankSuggestion(suggestion.key); if (bankSuggestion?.key === suggestion.key) resetForm(); }}><Text style={styles.secondaryLabel}>Dismiss</Text></Pressable>
          </View>
        </View>)}
        {!bankSuggestion && suggestionLimit < suggestions.length && <Pressable accessibilityRole="button" style={styles.choice} onPress={() => setSuggestionLimit(suggestionLimit + 5)}><Text style={styles.choiceLabel}>Show more suggestions</Text></Pressable>}
        {dismissedBankSuggestions.length > 0 && <Pressable accessibilityRole="button" style={styles.choice} onPress={restoreBankSuggestions}><Text style={styles.choiceLabel}>Restore dismissed suggestions</Text></Pressable>}
      </View>

      {bankSuggestion && form}

      {due.length > 0 && (
        <View style={styles.reviewCard}>
          <Text style={styles.sectionTitle}>Review before tomorrow</Text>
          <Text style={styles.reviewTotal}>
            {due.length} renewing · {formatMoney(due.reduce((total, { subscription }) => total + subscription.amountCents, 0))} total
          </Text>
          {due.map(({ subscription, renewal }) => (
            <View key={subscription.id} style={styles.reviewRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.subscriptionName}>{subscription.name}{subscription.isSample ? ' · sample' : ''}</Text>
                <Text style={styles.subscriptionAmount}>{formatMoney(subscription.amountCents)}</Text>
              </View>
              <Text style={styles.meta}>Renews {renewal.toLocaleDateString()}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => review(subscription.id, localDateKey(renewal), 'keep')}><Text style={styles.primaryLabel}>Keep it</Text></Pressable>
                <CancelSubscriptionButton subscription={subscription} renewalDate={localDateKey(renewal)} />
              </View>
            </View>
          ))}
          <Text style={styles.smallNote}>Planning to cancel here does not cancel the subscription. Contact the provider before its deadline.</Text>
        </View>
      )}

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Upcoming ({active.length})</Text>
        {active.length === 0 ? <Text style={styles.bodyText}>Add a subscription to see its next renewal here.</Text> : active.map(subscriptionCard)}
      </View>
      {inactive.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Marked canceled ({inactive.length})</Text>
          {inactive.map(subscriptionCard)}
        </View>
      )}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showForm }} style={styles.choice} onPress={() => { if (showForm) Keyboard.dismiss(); setShowForm(!showForm); }}><Text style={styles.choiceLabel}>{showForm ? 'Hide form' : editingId ? 'Edit subscription' : 'Add subscription'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showReminderSettings }} style={styles.choice} onPress={() => setShowReminderSettings(!showReminderSettings)}><Text style={styles.choiceLabel}>Reminder settings</Text></Pressable>
      </View>
      {showReminderSettings && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Phone reminder</Text>
          <Text style={styles.bodyText}>Get one local notification at 9 AM the day before renewals. You can also review inside the app without notification permission.</Text>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: remindersEnabled }} style={[styles.reminderButton, remindersEnabled && styles.reminderOn]} onPress={() => void toggleReminders()}>
            <Text style={[styles.reminderLabel, remindersEnabled && styles.reminderOnLabel]}>{remindersEnabled ? 'Phone reminders on' : 'Turn on phone reminders'}</Text>
          </Pressable>
          {reminderMessage ? <Text style={styles.error}>{reminderMessage}</Text> : null}
        </View>
      )}


      {!bankSuggestion && form}

      <Text style={styles.footer}>Saved only on this device. GasFinder does not connect to subscription accounts or stop charges.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  inlineConfirmation: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingBottom: 4, flexShrink: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 35, letterSpacing: -1, flexShrink: 1 },
  homeButton: { backgroundColor: colors.ink, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6, minHeight: 44, justifyContent: 'center' },
  homeButtonText: { color: colors.surface, fontWeight: '700' },
  intro: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 19 },
  reviewCard: { backgroundColor: colors.paleOrange, borderLeftColor: colors.accent, borderLeftWidth: 4, borderRadius: 8, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  reviewTotal: { color: colors.accentDark, fontSize: 16, fontWeight: '800', marginTop: 4 },
  bodyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  reminderButton: { backgroundColor: colors.paleGreen, borderRadius: 7, padding: 13, alignItems: 'center', marginTop: 13 },
  reminderOn: { backgroundColor: colors.ink },
  reminderLabel: { color: colors.inkSoft, fontWeight: '700' },
  reminderOnLabel: { color: colors.surface },
  input: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 12, backgroundColor: colors.surface },
  fieldLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '700', marginTop: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  choice: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.paper, minHeight: 44, justifyContent: 'center' },
  choiceActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceLabel: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  choiceActiveLabel: { color: colors.surface },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  monthChoice: { minWidth: 48, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  smallNote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 9 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: 10 },
  saveButton: { backgroundColor: colors.accentDark, borderRadius: 6, alignItems: 'center', padding: 14, marginTop: 16 },
  saveLabel: { color: colors.surface, fontWeight: '800' },
  cancelEdit: { alignSelf: 'center', padding: 11 },
  listSection: { gap: 10 },
  subscriptionCard: { backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, borderRadius: 6, padding: 17 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subscriptionName: { color: colors.ink, fontSize: 16, fontWeight: '800', flex: 1 },
  subscriptionAmount: { color: colors.accentDark, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  decision: { color: colors.primary, fontSize: 12, lineHeight: 18, marginTop: 7 },
  textButton: { paddingVertical: 7, paddingRight: 9 },
  textButtonLabel: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  removeLabel: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  reviewRow: { borderTopColor: colors.lineStrong, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 7, alignItems: 'center', padding: 11 },
  primaryLabel: { color: colors.surface, fontWeight: '700' },
  secondaryButton: { flex: 1, backgroundColor: colors.surface, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, alignItems: 'center', padding: 11 },
  secondaryLabel: { color: colors.inkSoft, fontWeight: '700' },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  confirmCard: { backgroundColor: colors.dangerPale, borderColor: colors.accent, borderWidth: 1, borderRadius: 10, padding: 16 },
});
