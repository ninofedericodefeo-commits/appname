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
    <View style={styles.header}><Text style={styles.title}>Savings pocket</Text><Link href="/" asChild><Pressable accessibilityRole="button" style={styles.nav}><Text style={styles.navText}>Gas prices</Text></Pressable></Link></View>
    <View style={styles.notice}><Text style={styles.noticeTitle}>A tracker for your existing account</Text><Text style={styles.noticeText}>The money stays in your bank account. This app does not connect to your bank, move money, verify your balance, or prevent you from spending it. Update the balance yourself to keep this estimate useful.</Text></View>
    <View style={styles.card}><Text style={styles.section}>Your estimate</Text>
      <Text style={styles.label}>Account balance you entered</Text><Text style={styles.value}>{reportedBalanceCents === null ? 'Not entered' : money(reportedBalanceCents)}</Text>
      {balanceUpdatedAt && <Text style={styles.hint}>Updated {new Date(balanceUpdatedAt).toLocaleDateString()}</Text>}
      <Text style={styles.label}>Earmarked for savings</Text><Text style={styles.value}>{money(reservedCents)}</Text>
      {activeGoal && <Text style={styles.hint}>{money(activeGoal.savedCents)} assigned to {activeGoal.title} · {money(unassigned)} unassigned</Text>}
      <Text style={styles.label}>Estimated available to spend</Text><Text style={[styles.value, available !== null && available < 0 && styles.negative]}>{available === null ? 'Enter a balance' : money(available)}</Text>
      {available !== null && available < 0 && <Text style={styles.error}>Your entered balance is below the earmarked amount. Update it or release some savings.</Text>}
    </View>
    <View style={styles.card}><Text style={styles.section}>Update your account balance</Text><Text style={styles.hint}>Copy the current balance from your bank app. This value is stored on this device.</Text><TextInput value={balanceInput} onChangeText={setBalanceInput} style={styles.input} keyboardType="decimal-pad" placeholder="250.00" accessibilityLabel="Account balance" /><Pressable accessibilityRole="button" style={styles.button} onPress={updateBalance}><Text style={styles.buttonText}>Save balance</Text></Pressable></View>
    <View style={styles.card}><Text style={styles.section}>Change unassigned pocket money</Text><Text style={styles.hint}>To change money assigned to a goal, use Savings goals.</Text><TextInput value={amountInput} onChangeText={setAmountInput} style={styles.input} keyboardType="decimal-pad" placeholder="25.00" accessibilityLabel="Pocket amount" /><View style={styles.row}><Pressable accessibilityRole="button" style={styles.button} onPress={() => changePocket('reserve')}><Text style={styles.buttonText}>Set aside</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => changePocket('release')}><Text style={styles.secondaryText}>Release unassigned</Text></Pressable></View>{error ? <Text style={styles.error}>{error}</Text> : null}</View>
    <View style={styles.card}><Text style={styles.section}>Pocket history</Text>{entries.length === 0 ? <Text style={styles.hint}>Your changes will appear here.</Text> : entries.map((item) => <View style={styles.entry} key={item.id}><Text style={styles.entryText}>{item.kind === 'assign' ? 'Assigned to goal' : item.kind === 'reserve' ? 'Set aside' : 'Released'} {money(item.amountCents)}{item.goalId ? ' · goal' : ''}</Text><Text style={styles.hint}>{new Date(item.createdAt).toLocaleDateString()}</Text></View>)}</View>
    <Link href="/investment" asChild><Pressable accessibilityRole="button" style={styles.legacy}><Text style={styles.hint}>Open Savings goals</Text></Pressable></Link>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f5f7' }, content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { color: '#111827', fontSize: 27, fontWeight: '800', flexShrink: 1 },
  nav: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 }, navText: { color: '#fff', fontWeight: '700' },
  notice: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 15, padding: 15 }, noticeTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 15 }, noticeText: { color: '#334155', fontSize: 13, lineHeight: 19, marginTop: 5 },
  card: { backgroundColor: '#fff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 17, padding: 16 }, section: { color: '#111827', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  label: { color: '#64748b', fontSize: 12, marginTop: 8 }, value: { color: '#111827', fontSize: 24, fontWeight: '800', marginTop: 3 }, negative: { color: '#b91c1c' }, hint: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontSize: 15, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, button: { backgroundColor: '#047857', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, alignSelf: 'flex-start' }, buttonText: { color: '#fff', fontWeight: '800' }, secondary: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13 }, secondaryText: { color: '#111827', fontWeight: '800' },
  error: { color: '#b91c1c', fontSize: 12, lineHeight: 18, marginTop: 8 }, entry: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopColor: '#e5e7eb', borderTopWidth: 1 }, entryText: { color: '#111827', fontWeight: '600' }, legacy: { alignSelf: 'center', padding: 10 },
});
