import { useState, useSyncExternalStore } from 'react';
import { Keyboard, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { accountBalanceEstimate } from '@/features/pocket/balanceEstimate';
import { parseDollars } from '@/features/pocket/logic';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';
import { previewSavingsAdjustment } from './savingsAdjustment';
import type { SavingsAction, SavingsDestination } from './savingsAdjustment';

export default function SavingsAdjustmentSheet({ initialDestination, initialAction = 'add', onClose }: {
  initialDestination: SavingsDestination; initialAction?: SavingsAction; onClose: () => void;
}) {
  const pocket = usePocketStore();
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [goalId] = useState(pocket.activeGoal?.id ?? null);
  const [destination, setDestination] = useState(initialDestination);
  const [action, setAction] = useState(initialAction);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const estimatedBalanceCents = accountBalanceEstimate(pocket).estimatedCents;
  const cents = parseDollars(amount);
  const inputError = amount.trim() && (cents === null || cents === 0) ? 'Enter an amount greater than $0, using at most two decimal places.' : '';
  const preview = cents !== null && cents > 0 ? previewSavingsAdjustment({ ...pocket, estimatedBalanceCents }, destination, action, cents, goalId) : null;
  const current = destination === 'goal' ? pocket.activeGoal?.savedCents ?? 0 : pocket.reservedCents - (pocket.activeGoal?.savedCents ?? 0);
  const available = estimatedBalanceCents === null ? null : estimatedBalanceCents - pocket.reservedCents;
  function close() { Keyboard.dismiss(); onClose(); }
  function save() {
    if (!ready || cents === null) return;
    const live = usePocketStore.getState();
    const checked = previewSavingsAdjustment({ ...live, estimatedBalanceCents: accountBalanceEstimate(live).estimatedCents }, destination, action, cents, goalId);
    if (checked.error) return setError(checked.error);
    const saved = destination === 'goal' ? action === 'add' ? live.reserveForGoal(cents) : live.releaseFromGoal(cents)
      : action === 'add' ? live.reserve(cents) : live.release(cents);
    if (!saved) return setError('Your savings changed. Check the amount and try again.');
    close();
  }
  return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><Text style={styles.title}>{action === 'add' ? 'Add money' : 'Adjust savings'}</Text><SubscriptionButton label="Close" onPress={close} /></View>
    <FormScrollView contentContainerStyle={styles.form}>
      <Text style={styles.label}>Destination</Text>
      <View style={styles.choices}>{pocket.activeGoal && <SubscriptionButton label={`Goal: ${pocket.activeGoal.title}`} accessibilityState={{ selected: destination === 'goal' }} tone={destination === 'goal' ? 'primary' : 'secondary'} onPress={() => { setDestination('goal'); setError(''); }} />}
        <SubscriptionButton label="Unassigned savings" accessibilityState={{ selected: destination === 'unassigned' }} tone={destination === 'unassigned' ? 'primary' : 'secondary'} onPress={() => { setDestination('unassigned'); setError(''); }} /></View>
      <Text style={styles.note}>{formatMoney(current)} currently {destination === 'goal' ? 'assigned to this goal' : 'unassigned'}.</Text>
      <View style={styles.row}>{(['add', 'lower'] as const).map(value => <SubscriptionButton key={value} label={value === 'add' ? 'Add' : 'Lower'} grow accessibilityState={{ selected: action === value }} tone={action === value ? 'primary' : 'secondary'} onPress={() => { setAction(value); setError(''); }} />)}</View>
      <Text style={styles.label}>Amount</Text><TextInput accessibilityLabel="Savings adjustment amount" value={amount} onChangeText={value => { setAmount(value); setError(''); }} style={styles.input} placeholder="0.00" keyboardType="decimal-pad" />
      {available === null ? <Text style={styles.note}>No bank balance saved yet. Availability cannot be checked.</Text> : <Text style={styles.note}>Estimated available now: {formatMoney(available)}.</Text>}
      {preview && !preview.error && <View style={styles.preview}><Text style={styles.label}>After saving</Text>
        <Text style={styles.summary}>{destination === 'goal' ? 'Goal savings' : 'Unassigned savings'}: {formatMoney(preview.destinationBeforeCents)} → {formatMoney(preview.destinationAfterCents)}</Text>
        <Text style={styles.summary}>Total set aside: {formatMoney(pocket.reservedCents)} → {formatMoney(preview.reservedAfterCents)}</Text>
        {preview.availableAfterCents !== null && <Text style={styles.summary}>Estimated available: {formatMoney(preview.availableAfterCents)}</Text>}
      </View>}
      {!!(error || inputError || preview?.error) && <Text accessibilityLiveRegion="polite" style={styles.error}>{error || inputError || preview?.error}</Text>}
      <Text style={styles.note}>Money stays in your bank account. This changes how much you have set aside{destination === 'goal' ? ' and your goal progress' : ''}.</Text>
      <View style={styles.row}><SubscriptionButton label="Cancel" grow onPress={close} /><SubscriptionButton label="Save adjustment" tone="primary" grow disabled={!ready || !preview || !!preview.error} onPress={save} /></View>
    </FormScrollView>
  </SafeAreaView></Modal>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, header: { padding: 20, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 12, alignItems: 'center' }, title: { flex: 1, color: colors.ink, fontSize: 25, fontWeight: '800' }, form: { padding: 20, paddingBottom: 40, gap: 16 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, choices: { gap: 8, alignItems: 'stretch' }, row: { flexDirection: 'row', gap: 8 }, input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, color: colors.ink, fontSize: 18, backgroundColor: colors.surface }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, preview: { padding: 16, borderRadius: 12, backgroundColor: colors.paleGreen, gap: 9 }, summary: { color: colors.ink, fontSize: 14, lineHeight: 21 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 } });
