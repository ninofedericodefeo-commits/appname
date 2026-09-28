import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePurchasePauseStore } from '@/stores/purchasePauseStore';
import type { PurchasePauseDelayHours } from '@/stores/purchasePauseStore';

const delays: { hours: PurchasePauseDelayHours; label: string }[] = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '2 days' },
  { hours: 168, label: '7 days' },
];

function formatTimeRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function SpendingScreen() {
  const { enabled, delayHours, items, setEnabled, setDelayHours, addPurchase, recordOutcome } = usePurchasePauseStore();
  const [purchaseName, setPurchaseName] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const waitingItems = items.filter((item) => item.status === 'waiting');
  const skippedItems = items.filter((item) => item.status === 'skipped');
  const reportedAvoidedTotal = skippedItems.reduce((total, item) => total + item.amount, 0);

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const initialTimer = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, 60_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  function savePurchase() {
    const amount = Number(purchaseAmount);
    const name = purchaseName.trim();
    if (!name) {
      setError('Add a short name for the purchase.');
      return;
    }
    if (!purchaseAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter an estimated amount greater than $0.');
      return;
    }

    addPurchase(name, amount);
    setPurchaseName('');
    setPurchaseAmount('');
    setError('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Spending pause</Text>
          <Link href="/investment" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Investing</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>OPTIONAL · ON THIS DEVICE</Text>
          <Text style={styles.cardTitle}>Pause before an online purchase</Text>
          <Text style={styles.description}>
            Add something you are considering buying, then give yourself time to decide. This is a reminder and personal tracker only: it does not monitor your accounts or block checkout.
          </Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled }}
            style={[styles.toggle, enabled && styles.toggleEnabled]}
            onPress={() => setEnabled(!enabled)}
          >
            <Text style={[styles.toggleText, enabled && styles.toggleTextEnabled]}>
              {enabled ? 'Pause reminders on' : 'Turn on pause reminders'}
            </Text>
          </Pressable>
          {enabled && (
            <>
              <Text style={styles.label}>Cooling-off period</Text>
              <View style={styles.row}>
                {delays.map((delay) => (
                  <Choice
                    key={delay.hours}
                    label={delay.label}
                    selected={delayHours === delay.hours}
                    onPress={() => setDelayHours(delay.hours)}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {enabled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a purchase to pause</Text>
            <TextInput
              value={purchaseName}
              onChangeText={setPurchaseName}
              placeholder="What are you thinking of buying?"
              accessibilityLabel="Purchase description"
              maxLength={80}
              style={styles.input}
            />
            <TextInput
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              placeholder="Estimated price"
              accessibilityLabel="Estimated purchase price"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={savePurchase}>
              <Text style={styles.primaryButtonText}>Start cooling-off period</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>You reported skipping</Text>
          <Text style={styles.summaryAmount}>${reportedAvoidedTotal.toFixed(2)}</Text>
          <Text style={styles.summaryNote}>
            User-reported estimate from {skippedItems.length} skipped purchase{skippedItems.length === 1 ? '' : 's'}; this is not verified savings.
          </Text>
        </View>

        {waitingItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Still considering</Text>
            {waitingItems.map((item) => {
              const remaining = item.reviewAt - (now ?? item.createdAt);
              const ready = remaining <= 0;
              return (
                <View key={item.id} style={styles.purchaseItem}>
                  <View style={styles.purchaseHeading}>
                    <View style={styles.purchaseDetails}>
                      <Text style={styles.purchaseName}>{item.name}</Text>
                      <Text style={styles.purchasePrice}>${item.amount.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statusBubble, ready && styles.statusReady]}>
                      <Text style={[styles.statusText, ready && styles.statusReadyText]}>
                        {ready ? 'Ready to review' : formatTimeRemaining(remaining)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dateText}>
                    Review after {new Date(item.reviewAt).toLocaleString()}
                  </Text>
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineButton}
                      onPress={() => recordOutcome(item.id, 'skipped')}
                    >
                      <Text style={styles.outlineButtonText}>I skipped it</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineButton}
                      onPress={() => recordOutcome(item.id, 'bought')}
                    >
                      <Text style={styles.outlineButtonText}>I bought it</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {items.some((item) => item.status !== 'waiting') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed decisions</Text>
            {items
              .filter((item) => item.status !== 'waiting')
              .map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.purchaseDetails}>
                    <Text style={styles.purchaseName}>{item.name}</Text>
                    <Text style={styles.dateText}>
                      {item.status === 'skipped' ? 'You reported skipping' : 'You reported buying'} ·{' '}
                      {new Date(item.outcomeAt ?? item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.purchasePrice}>${item.amount.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#111827', fontSize: 28, fontWeight: '800' },
  navButton: { backgroundColor: '#111827', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e7ebf0' },
  eyebrow: { color: '#4f46e5', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginTop: 4 },
  description: { color: '#5f6470', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 10 },
  toggle: { borderRadius: 12, padding: 13, backgroundColor: '#f3f4f6', alignItems: 'center', marginTop: 5 },
  toggleEnabled: { backgroundColor: '#4f46e5' },
  toggleText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  toggleTextEnabled: { color: '#ffffff' },
  label: { color: '#4b5563', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#d5dbe4', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  choiceSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: '#ffffff' },
  input: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#d5dbe4', paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 10 },
  primaryButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 7 },
  summaryCard: { backgroundColor: '#eef2ff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#c7d2fe' },
  summaryLabel: { color: '#4338ca', fontSize: 13, fontWeight: '700' },
  summaryAmount: { color: '#312e81', fontSize: 32, fontWeight: '800', marginTop: 4 },
  summaryNote: { color: '#4b5563', fontSize: 12, lineHeight: 17, marginTop: 4 },
  purchaseItem: { borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 12, marginTop: 12 },
  purchaseHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  purchaseDetails: { flex: 1 },
  purchaseName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  purchasePrice: { color: '#111827', fontSize: 14, fontWeight: '700' },
  statusBubble: { backgroundColor: '#fff7ed', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9 },
  statusReady: { backgroundColor: '#dcfce7' },
  statusText: { color: '#9a3412', fontSize: 11, fontWeight: '700' },
  statusReadyText: { color: '#166534' },
  dateText: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  outlineButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexGrow: 1, alignItems: 'center' },
  outlineButtonText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 12, marginTop: 12 },
});
