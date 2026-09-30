import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDateKey, nextRenewal, subscriptionsToReviewTomorrow } from '@/features/subscriptions/logic';
import type { Subscription } from '@/features/subscriptions/logic';
import { requestSubscriptionReminderPermission, syncSubscriptionReminders } from '@/features/subscriptions/reminders';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SubscriptionsScreen() {
  const { subscriptions, remindersEnabled, setRemindersEnabled, saveSubscription, setActive, review, removeSubscription } = useSubscriptionStore();
  const [today, setToday] = useState(() => new Date());
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Subscription['cadence']>('monthly');
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
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
    setCadence('monthly');
    setDay('1');
    setMonth(1);
    setEditingId(null);
    setError('');
  }

  function save() {
    const trimmedName = name.trim();
    const amountCents = /^\d+(?:\.\d{1,2})?$/.test(amount.trim()) ? Math.round(Number(amount) * 100) : NaN;
    const billingDay = Number(day);
    if (!trimmedName) return setError('Enter the subscription name.');
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
      return setError('Enter a price greater than $0, with no more than two decimal places.');
    }
    if (!/^\d+$/.test(day.trim()) || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
      return setError('Enter a renewal day from 1 to 31.');
    }
    saveSubscription({ name: trimmedName, amountCents, cadence, day: billingDay, month }, editingId ?? undefined);
    resetForm();
  }

  function edit(subscription: Subscription) {
    setEditingId(subscription.id);
    setName(subscription.name);
    setAmount((subscription.amountCents / 100).toFixed(2));
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
          <Text style={styles.subscriptionAmount}>${(subscription.amountCents / 100).toFixed(2)}</Text>
        </View>
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
          <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => setRemoveId(subscription.id)}><Text style={styles.removeLabel}>Delete</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Subscriptions</Text>
          <Link href="/" asChild><Pressable style={styles.homeButton} accessibilityRole="button"><Text style={styles.homeButtonText}>Gas prices</Text></Pressable></Link>
        </View>
        <Text style={styles.intro}>See tomorrow’s renewals before they charge, and decide which subscriptions still earn their place.</Text>

        {due.length > 0 && (
          <View style={styles.reviewCard}>
            <Text style={styles.sectionTitle}>Review before tomorrow</Text>
            <Text style={styles.reviewTotal}>
              {due.length} renewing · ${(due.reduce((total, { subscription }) => total + subscription.amountCents, 0) / 100).toFixed(2)} total
            </Text>
            {due.map(({ subscription, renewal }) => (
              <View key={subscription.id} style={styles.reviewRow}>
                <View style={styles.rowBetween}>
                  <Text style={styles.subscriptionName}>{subscription.name}</Text>
                  <Text style={styles.subscriptionAmount}>${(subscription.amountCents / 100).toFixed(2)}</Text>
                </View>
                <Text style={styles.meta}>Renews {renewal.toLocaleDateString()}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => review(subscription.id, localDateKey(renewal), 'keep')}><Text style={styles.primaryLabel}>Keep it</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => review(subscription.id, localDateKey(renewal), 'plan-to-cancel')}><Text style={styles.secondaryLabel}>Plan to cancel</Text></Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.smallNote}>Planning to cancel here does not cancel the subscription. Contact the provider before its deadline.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Phone reminder</Text>
          <Text style={styles.bodyText}>Get one local notification at 9 AM the day before renewals. You can also review inside the app without notification permission.</Text>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: remindersEnabled }} style={[styles.reminderButton, remindersEnabled && styles.reminderOn]} onPress={() => void toggleReminders()}>
            <Text style={[styles.reminderLabel, remindersEnabled && styles.reminderOnLabel]}>{remindersEnabled ? 'Phone reminders on' : 'Turn on phone reminders'}</Text>
          </Pressable>
          {reminderMessage ? <Text style={styles.error}>{reminderMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'Edit subscription' : 'Add a subscription'}</Text>
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
          {cadence === 'yearly' && (
            <View style={styles.months}>
              {monthNames.map((label, index) => (
                <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: month === index + 1 }} style={[styles.monthChoice, month === index + 1 && styles.choiceActive]} onPress={() => setMonth(index + 1)}>
                  <Text style={[styles.choiceLabel, month === index + 1 && styles.choiceActiveLabel]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput style={styles.input} value={day} onChangeText={setDay} placeholder="Day of month (1–31)" accessibilityLabel="Renewal day of month" keyboardType="number-pad" maxLength={2} />
          <Text style={styles.smallNote}>For months without that day, the renewal is shown on the last day of the month.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.saveButton} onPress={save}><Text style={styles.saveLabel}>{editingId ? 'Save changes' : 'Add subscription'}</Text></Pressable>
          {editingId && <Pressable accessibilityRole="button" style={styles.cancelEdit} onPress={resetForm}><Text style={styles.textButtonLabel}>Stop editing</Text></Pressable>}
        </View>

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
        <Text style={styles.footer}>Saved only on this device. GasFinder does not connect to subscription accounts or stop charges.</Text>
        {removeId && (
          <View style={styles.confirmCard}>
            <Text style={styles.sectionTitle}>Delete this subscription?</Text>
            <Text style={styles.bodyText}>Its local reminder and review record will be removed.</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => { removeSubscription(removeId); if (editingId === removeId) resetForm(); setRemoveId(null); }}><Text style={styles.primaryLabel}>Delete</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setRemoveId(null)}><Text style={styles.secondaryLabel}>Keep it</Text></Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  content: { padding: 20, paddingBottom: 45, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: '#111827', fontSize: 30, fontWeight: '800' },
  homeButton: { backgroundColor: '#111827', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  homeButtonText: { color: '#ffffff', fontWeight: '700' },
  intro: { color: '#475569', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#ffffff', borderColor: '#e7ebf0', borderWidth: 1, borderRadius: 18, padding: 18 },
  reviewCard: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: 18, padding: 18 },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  reviewTotal: { color: '#4338ca', fontSize: 14, fontWeight: '700', marginTop: 4 },
  bodyText: { color: '#5f6470', fontSize: 13, lineHeight: 19, marginTop: 7 },
  reminderButton: { backgroundColor: '#f1f5f9', borderRadius: 11, padding: 13, alignItems: 'center', marginTop: 13 },
  reminderOn: { backgroundColor: '#4f46e5' },
  reminderLabel: { color: '#334155', fontWeight: '700' },
  reminderOnLabel: { color: '#ffffff' },
  input: { borderColor: '#d5dbe4', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 12, backgroundColor: '#ffffff' },
  fieldLabel: { color: '#4b5563', fontSize: 13, fontWeight: '700', marginTop: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  choice: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#f8fafc' },
  choiceActive: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceLabel: { color: '#334155', fontWeight: '700', fontSize: 13 },
  choiceActiveLabel: { color: '#ffffff' },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  monthChoice: { minWidth: 48, borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 8, alignItems: 'center' },
  smallNote: { color: '#64748b', fontSize: 12, lineHeight: 17, marginTop: 9 },
  error: { color: '#b91c1c', fontSize: 13, lineHeight: 18, marginTop: 10 },
  saveButton: { backgroundColor: '#4f46e5', borderRadius: 11, alignItems: 'center', padding: 13, marginTop: 16 },
  saveLabel: { color: '#ffffff', fontWeight: '800' },
  cancelEdit: { alignSelf: 'center', padding: 11 },
  listSection: { gap: 10 },
  subscriptionCard: { backgroundColor: '#ffffff', borderColor: '#e7ebf0', borderWidth: 1, borderRadius: 15, padding: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subscriptionName: { color: '#111827', fontSize: 16, fontWeight: '800', flex: 1 },
  subscriptionAmount: { color: '#111827', fontSize: 16, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 12, marginTop: 4 },
  decision: { color: '#4338ca', fontSize: 12, lineHeight: 18, marginTop: 7 },
  textButton: { paddingVertical: 7, paddingRight: 9 },
  textButtonLabel: { color: '#4338ca', fontWeight: '700', fontSize: 13 },
  removeLabel: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  reviewRow: { borderTopColor: '#c7d2fe', borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  primaryButton: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 10, alignItems: 'center', padding: 11 },
  primaryLabel: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { flex: 1, backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, alignItems: 'center', padding: 11 },
  secondaryLabel: { color: '#334155', fontWeight: '700' },
  footer: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  confirmCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 15, padding: 16 },
});
