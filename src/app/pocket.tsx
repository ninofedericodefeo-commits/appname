import { colors } from '@/theme';
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { availableCents, parseDollars } from '@/features/pocket/logic';
import { usePocketStore } from '@/stores/pocketStore';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function PocketScreen() {
  const { reportedBalanceCents, balanceUpdatedAt, reservedCents, activeGoal, entries, setReportedBalance, reserve, release } = usePocketStore();
  const [balanceInput, setBalanceInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState('');
  const available = availableCents(reportedBalanceCents, reservedCents);
  const unassigned = reservedCents - (activeGoal?.savedCents ?? 0);

  function updateBalance() {
    const cents = parseDollars(balanceInput);
    if (cents === null) { setError('Enter a balance using at most two decimal places.'); return; }
    setReportedBalance(cents);
    setBalanceInput('');
    setError('');
  }

  function changePocket(kind: 'reserve' | 'release') {
    const cents = parseDollars(amountInput);
    if (cents === null || cents === 0) { setError('Enter an amount greater than $0, using at most two decimal places.'); return; }
    const saved = kind === 'reserve' ? reserve(cents) : release(cents);
    if (!saved) { setError(kind === 'reserve' ? 'That amount exceeds the available balance you entered.' : 'That amount exceeds unassigned pocket money. Release goal money from Savings goals.'); return; }
    setAmountInput('');
    setError('');
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>SAVINGS</Text>
    <Text style={styles.title}>Savings pocket</Text>
    <View style={styles.balanceCard}>
      <Text style={styles.balanceEyebrow}>YOUR MONEY / MANUALLY REPORTED</Text>
      <Text style={styles.balanceLabel}>Estimated available to spend</Text>
      <Text style={[styles.balanceMain, available !== null && available < 0 && styles.balanceNegative]}>{available === null ? 'Enter a balance' : money(available)}</Text>
      <View style={styles.balanceRule} />
      <View style={styles.balanceRow}><Text style={styles.balanceLabel}>Account balance you entered</Text><Text style={styles.balanceValue}>{reportedBalanceCents === null ? 'Not entered' : money(reportedBalanceCents)}</Text></View>
      {balanceUpdatedAt && <Text style={styles.balanceHint}>Updated {new Date(balanceUpdatedAt).toLocaleDateString()}</Text>}
      <View style={styles.balanceRow}><Text style={styles.balanceLabel}>Earmarked for savings</Text><Text style={styles.balanceValue}>{money(reservedCents)}</Text></View>
      {activeGoal && <Text style={styles.balanceHint}>{money(activeGoal.savedCents)} assigned to {activeGoal.title} · {money(unassigned)} unassigned</Text>}
      {available !== null && available < 0 && <Text style={styles.balanceWarning}>Your entered balance is below the earmarked amount. Update it or release some savings.</Text>}
    </View>
    <View style={styles.notice}><Text style={styles.noticeTitle}>A tracker for your existing account</Text><Text style={styles.noticeText}>The money stays in your bank account. GasFinder does not connect to it, move money, verify your balance, or block spending. Update your balance here to keep this estimate useful.</Text></View>
    <View style={styles.card}><Text style={styles.section}>Update your account balance</Text><Text style={styles.hint}>Copy the current balance from your bank app. This value is stored on this device.</Text><TextInput value={balanceInput} onChangeText={setBalanceInput} style={styles.input} keyboardType="decimal-pad" placeholder="250.00" accessibilityLabel="Account balance" /><Pressable accessibilityRole="button" style={styles.button} onPress={updateBalance}><Text style={styles.buttonText}>Save balance</Text></Pressable></View>
    <View style={styles.card}><Text style={styles.section}>Change unassigned pocket money</Text><Text style={styles.hint}>To change money assigned to a goal, use Savings goals.</Text><TextInput value={amountInput} onChangeText={setAmountInput} style={styles.input} keyboardType="decimal-pad" placeholder="25.00" accessibilityLabel="Pocket amount" /><View style={styles.row}><Pressable accessibilityRole="button" style={styles.button} onPress={() => changePocket('reserve')}><Text style={styles.buttonText}>Set aside</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => changePocket('release')}><Text style={styles.secondaryText}>Release unassigned</Text></Pressable></View>{error ? <Text style={styles.error}>{error}</Text> : null}</View>
    <View style={styles.card}><Text style={styles.section}>Pocket history</Text>{entries.length === 0 ? <Text style={styles.hint}>Your changes will appear here.</Text> : entries.map((item) => <View style={styles.entry} key={item.id}><Text style={styles.entryText}>{item.kind === 'assign' ? 'Assigned to goal' : item.kind === 'reserve' ? 'Set aside' : 'Released'} {money(item.amountCents)}{item.goalId ? ' · goal' : ''}</Text><Text style={styles.hint}>{new Date(item.createdAt).toLocaleDateString()}</Text></View>)}</View>
    <Link href="/investment" asChild><Pressable accessibilityRole="button" style={styles.legacy}><Text style={styles.hint}>Open Savings goals</Text></Pressable></Link>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 },
  nav: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }, navText: { color: colors.surface, fontWeight: '700' },
  notice: { backgroundColor: colors.paleGreen, borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 15 }, noticeTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 }, noticeText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 19 }, section: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 13 },
  label: { color: colors.muted, fontSize: 12, marginTop: 8 }, value: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 3 }, hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  input: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontSize: 15, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, button: { backgroundColor: colors.accentDark, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 13, alignSelf: 'flex-start' }, buttonText: { color: colors.surface, fontWeight: '800' }, secondary: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 13 }, secondaryText: { color: colors.ink, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 8 }, entry: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopColor: colors.line, borderTopWidth: 1 }, entryText: { color: colors.ink, fontWeight: '600' }, legacy: { alignSelf: 'center', padding: 10 },
  balanceCard: { backgroundColor: colors.ink, borderRadius: 12, padding: 21, gap: 8 },
  balanceEyebrow: { color: colors.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 15 },
  balanceLabel: { color: colors.surface, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  balanceMain: { color: colors.surface, fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'], marginBottom: 9 },
  balanceNegative: { color: '#FFB49A' },
  balanceRule: { borderTopWidth: 1, borderColor: colors.inkSoft, marginVertical: 5 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  balanceValue: { color: colors.lime, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  balanceHint: { color: colors.lime, fontSize: 12, lineHeight: 18 },
  balanceWarning: { color: colors.surface, fontSize: 12, lineHeight: 18, marginTop: 8 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 1 },
});
