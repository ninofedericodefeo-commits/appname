import { formatAmount, formatMoney } from '@/lib/money';
import { parseDollars } from '@/features/pocket/logic';
import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePurchasePauseStore } from '@/stores/purchasePauseStore';
import { usePocketStore } from '@/stores/pocketStore';
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

export default function SpendingPausePanel() {
  const { enabled, delayHours, items, setEnabled, setDelayHours, addPurchase, recordOutcome, removePurchase } = usePurchasePauseStore();
  const [purchaseName, setPurchaseName] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [error, setError] = useState('');
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingBought, setPendingBought] = useState<{ id: string; name: string; amount: number; waiting: boolean } | null>(null);
  const [actualAmount, setActualAmount] = useState('');
  const [buyError, setBuyError] = useState('');
  const { purchases, addPurchase: addGoalPurchase } = usePocketStore();
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
    const cents = parseDollars(purchaseAmount);
    const amount = cents === null ? NaN : cents / 100;
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
    setShowPurchaseForm(false);
    setError('');
  }

  function offerToLog(id: string, name: string, amount: number, waiting: boolean) {
    setPendingBought({ id, name, amount, waiting });
    setActualAmount(formatAmount(Math.round(amount * 100)));
    setBuyError('');
  }

  function logBoughtPurchase() {
    if (!pendingBought) return;
    const amount = actualAmount.trim();
    const cents = parseDollars(amount) ?? NaN;
    if (!Number.isSafeInteger(cents) || cents <= 0) { setBuyError('Enter the actual amount paid, greater than $0.'); return; }
    if (!addGoalPurchase(`${Date.now()}-${Math.random().toString(36).slice(2)}`, pendingBought.name, cents, pendingBought.id)) {
      setBuyError('This purchase has already been logged.'); return;
    }
    if (pendingBought.waiting) recordOutcome(pendingBought.id, 'bought');
    Keyboard.dismiss();
    setPendingBought(null);
    router.push('/account-transactions');
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Spending pause</Text>

      <View style={styles.card}>
        <Text style={styles.description}>
          Give a purchase time before deciding. This optional planner uses your own entries; it does not monitor accounts, block checkout, or send notifications.
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          style={[styles.toggle, enabled && styles.toggleEnabled]}
          onPress={() => setEnabled(!enabled)}
        >
          <Text style={[styles.toggleText, enabled && styles.toggleTextEnabled]}>
            {enabled ? 'Pause planner on' : 'Turn on pause planner'}
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

      {enabled && <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPurchaseForm }} style={styles.outlineButton} onPress={() => { if (showPurchaseForm) Keyboard.dismiss(); setShowPurchaseForm(!showPurchaseForm); }}><Text style={styles.outlineButtonText}>{showPurchaseForm ? 'Hide purchase form' : 'Pause a purchase'}</Text></Pressable>}
      {enabled && showPurchaseForm && (
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
        <Text style={styles.summaryAmount}>{formatMoney(Math.round(reportedAvoidedTotal * 100))}</Text>
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
                    <Text style={styles.purchasePrice}>{formatMoney(Math.round(item.amount * 100))}</Text>
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
                    onPress={() => offerToLog(item.id, item.name, item.amount, true)}
                  >
                    <Text style={styles.outlineButtonText}>I bought it</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => setPendingRemovalId(item.id)}>
                    <Text style={styles.outlineButtonText}>Remove</Text>
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
                <View style={styles.historyActions}>
                  <Text style={styles.purchasePrice}>{formatMoney(Math.round(item.amount * 100))}</Text>
                  <Pressable accessibilityRole="button" style={styles.removeButton} onPress={() => setPendingRemovalId(item.id)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                  {item.status === 'bought' && !purchases.some((purchase) => purchase.sourcePauseId === item.id) && <Pressable accessibilityRole="button" style={styles.removeButton} onPress={() => offerToLog(item.id, item.name, item.amount, false)}><Text style={styles.removeText}>Log actual purchase</Text></Pressable>}
                </View>
              </View>
            ))}
        </View>
      )}
      {pendingRemovalId && (
        <View style={styles.confirmCard}>
          <Text style={styles.purchaseName}>Remove this local purchase record?</Text>
          <Text style={styles.dateText}>The user-reported skipped total will update if needed.</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => { removePurchase(pendingRemovalId); setPendingRemovalId(null); }}><Text style={styles.primaryButtonText}>Remove</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => setPendingRemovalId(null)}><Text style={styles.outlineButtonText}>Cancel</Text></Pressable>
          </View>
        </View>
      )}
      <Modal animationType="slide" visible={pendingBought !== null} onRequestClose={() => setPendingBought(null)}>
        <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Log what you paid?</Text>
          <Text style={styles.description}>This will add the purchase to your savings goal history and offer a set-aside amount. It will not charge you or move money.</Text>
          <View style={styles.card}><Text style={styles.cardTitle}>{pendingBought?.name}</Text><Text style={styles.label}>Actual amount paid</Text><TextInput style={styles.input} value={actualAmount} onChangeText={setActualAmount} keyboardType="decimal-pad" accessibilityLabel="Actual amount paid" />{buyError ? <Text style={styles.error}>{buyError}</Text> : null}<View style={styles.row}><Pressable accessibilityRole="button" style={styles.primaryButton} onPress={logBoughtPurchase}><Text style={styles.primaryButtonText}>Log purchase</Text></Pressable><Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => { if (pendingBought?.waiting) recordOutcome(pendingBought.id, 'bought'); setPendingBought(null); }}><Text style={styles.outlineButtonText}>Bought without logging</Text></Pressable><Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => setPendingBought(null)}><Text style={styles.outlineButtonText}>Cancel</Text></Pressable></View></View>
        </ScrollView></SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  section: { gap: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18 },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 },
  navButton: { backgroundColor: colors.ink, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6, minHeight: 44, justifyContent: 'center' },
  navButtonText: { color: colors.surface, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: 9, padding: 19, borderWidth: 1, borderColor: colors.line },
  eyebrow: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 10 },
  toggle: { borderRadius: 8, padding: 13, backgroundColor: colors.paper, alignItems: 'center', marginTop: 5 },
  toggleEnabled: { backgroundColor: colors.primary },
  toggleText: { color: colors.inkSoft, fontSize: 14, fontWeight: '700' },
  toggleTextEnabled: { color: colors.surface },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9 },
  choice: { borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.paper, minHeight: 44, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: colors.surface },
  input: { backgroundColor: colors.surface, borderRadius: 7, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 10 },
  primaryButton: { backgroundColor: colors.accentDark, borderRadius: 6, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, marginTop: 7 },
  summaryCard: { backgroundColor: colors.paleGreen, borderRadius: 8, padding: 14 },
  summaryLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  summaryAmount: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 5, fontVariant: ['tabular-nums'] },
  summaryNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  purchaseItem: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12 },
  purchaseHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  purchaseDetails: { flex: 1 },
  purchaseName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  purchasePrice: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  statusBubble: { backgroundColor: colors.paleOrange, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9 },
  statusReady: { backgroundColor: colors.paleGreen },
  statusText: { color: colors.accentDark, fontSize: 11, fontWeight: '700' },
  statusReadyText: { color: colors.primary },
  dateText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  outlineButton: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, paddingVertical: 10, paddingHorizontal: 12, flexGrow: 1, alignItems: 'center' },
  outlineButtonText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12 },
  historyActions: { alignItems: 'flex-end' },
  removeButton: { paddingVertical: 8 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  confirmCard: { backgroundColor: colors.dangerPale, borderWidth: 1, borderColor: colors.accent, borderRadius: 10, padding: 15 },
});
