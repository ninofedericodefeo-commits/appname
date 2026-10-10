import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FormScrollView } from '@/components/FormScrollView';
import { availableCents, parseDollars } from '@/features/pocket/logic';
import { PocketTransactions } from '@/features/pocket/PocketTransactions';
import { pocketTransactions } from '@/features/pocket/transactions';
import { formatAmount, formatMoney as money } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

function AccountAction({ label, path, onPress }: { label: string; path: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
    <View style={styles.actionCircle}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.lime} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d={path} /></Svg></View>
    <Text style={styles.actionLabel}>{label}</Text>
  </Pressable>;
}

export default function PocketScreen() {
  const { reportedBalanceCents, balanceUpdatedAt, reservedCents, activeGoal, entries, purchases, accountTransactions, setReportedBalance, reserve, release } = usePocketStore();
  const [balanceDraft, setBalanceDraft] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [editingPocket, setEditingPocket] = useState(false);
  const [showCurrentBalance, setShowCurrentBalance] = useState(false);
  const [showPocketChanges, setShowPocketChanges] = useState(false);
  const [entryLimit, setEntryLimit] = useState(5);
  const [balanceError, setBalanceError] = useState('');
  const [pocketError, setPocketError] = useState('');
  const available = availableCents(reportedBalanceCents, reservedCents);
  const availableLabel = available === null ? '—' : money(available);
  const balanceFontSize = availableLabel.length > 9 ? Math.max(28, Math.floor(414 / availableLabel.length)) : 46;
  const unassigned = reservedCents - (activeGoal?.savedCents ?? 0);
  const balanceInput = balanceDraft ?? (reportedBalanceCents === null ? '' : formatAmount(reportedBalanceCents));
  const transactions = useMemo(() => pocketTransactions(accountTransactions, purchases), [accountTransactions, purchases]);

  function updateBalance() {
    const cents = parseDollars(balanceInput);
    if (cents === null) { setBalanceError('Enter a balance using at most two decimal places.'); return; }
    setReportedBalance(cents); setBalanceDraft(null); setBalanceError(''); setEditingBalance(false); setShowCurrentBalance(false); Keyboard.dismiss();
  }
  function changePocket(kind: 'reserve' | 'release') {
    const cents = parseDollars(amountInput);
    if (cents === null || cents === 0) { setPocketError('Enter an amount greater than $0, using at most two decimal places.'); return; }
    if (!(kind === 'reserve' ? reserve(cents) : release(cents))) {
      setPocketError(kind === 'reserve' ? 'That amount exceeds your available balance.' : 'That amount exceeds unassigned pocket money. Open Edit goal to lower goal savings.'); return;
    }
    setAmountInput(''); setPocketError(''); Keyboard.dismiss();
  }

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Pocket</Text>
      <View style={styles.balanceCard}>
        <View style={styles.accountHeading}><Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.lime} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 7V5h14v3M4 7h16v14H4V7Zm12 6h4v4h-4v-4Z" /></Svg><Text style={styles.accountName}>My account</Text></View>
        <Text style={styles.balanceLabel}>Available to spend</Text>
        <Text accessibilityLabel={available === null ? 'Available to spend: add your bank balance' : `Available to spend: ${money(available)}`} style={[styles.balanceMain, { fontSize: balanceFontSize }, available !== null && available < 0 && styles.balanceNegative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{availableLabel}</Text>
        <Text style={styles.formula}>{available === null ? 'Add your current bank balance to get started.' : 'Bank balance minus your Pocket'}</Text>
        <View style={styles.pocketRow}><Text style={styles.pocketLabel}>In your Pocket</Text><Text style={styles.pocketValue}>{money(reservedCents)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={showCurrentBalance ? 'Hide current bank balance' : 'Show current bank balance'} accessibilityState={{ expanded: showCurrentBalance }} onPress={() => setShowCurrentBalance(!showCurrentBalance)} style={styles.currentRow}>
          <Text style={styles.currentLabel}>Current balance</Text>
          <View style={styles.currentValueGroup}><Text style={styles.currentValue}>{showCurrentBalance ? (reportedBalanceCents === null ? 'Not entered' : money(reportedBalanceCents)) : '••••'}</Text><Text style={styles.reveal}>{showCurrentBalance ? '⌄' : '›'}</Text></View>
        </Pressable>
        {balanceUpdatedAt && <Text style={styles.updated}>Balance saved {new Date(balanceUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
        {available !== null && available < 0 && <Text accessibilityRole="alert" style={styles.balanceWarning}>Your Pocket is above your saved bank balance. Update the balance or lower your Pocket.</Text>}
        <View style={styles.accountActions}>
          <AccountAction label="Update balance" path="m16 3 5 5M3 21l5-1L20 8a3.54 3.54 0 0 0-5-5L3 15v6Z" onPress={() => { Keyboard.dismiss(); setEditingBalance(!editingBalance); setEditingPocket(false); }} />
          <AccountAction label="Edit Pocket" path="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" onPress={() => { Keyboard.dismiss(); setEditingPocket(!editingPocket); setEditingBalance(false); }} />
          <AccountAction label="Import statement" path="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" onPress={() => router.push('/bank-import')} />
        </View>
      </View>
      {editingBalance && <View style={styles.card}>
        <Text style={styles.section}>Update bank balance</Text><Text style={styles.hint}>Copy the current balance from your bank app.</Text>
        <TextInput value={balanceInput} onChangeText={setBalanceDraft} style={styles.input} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="Account balance" />
        {balanceError ? <Text accessibilityRole="alert" style={styles.error}>{balanceError}</Text> : null}
        <View style={styles.row}><Pressable accessibilityRole="button" style={styles.button} onPress={updateBalance}><Text style={styles.buttonText}>Save balance</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { Keyboard.dismiss(); setEditingBalance(false); }}><Text style={styles.secondaryText}>Close</Text></Pressable></View>
      </View>}
      {editingPocket && <View style={styles.card}>
        <Text style={styles.section}>Manage Pocket</Text><Text style={styles.hint}>{money(unassigned)} unassigned{activeGoal ? ` · ${money(activeGoal.savedCents)} for ${activeGoal.title}` : ''}</Text>
        <TextInput value={amountInput} onChangeText={setAmountInput} style={styles.input} keyboardType="decimal-pad" placeholder="Amount" accessibilityLabel="Pocket amount" />
        <View style={styles.row}><Pressable accessibilityRole="button" style={styles.button} onPress={() => changePocket('reserve')}><Text style={styles.buttonText}>Set aside</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => changePocket('release')}><Text style={styles.secondaryText}>Lower Pocket</Text></Pressable></View>
        {pocketError ? <Text accessibilityRole="alert" style={styles.error}>{pocketError}</Text> : null}
        <Text style={styles.hint}>Money stays in your bank account. Lower money assigned to a goal in Edit goal.</Text>
        <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => router.navigate('/investment')}><Text style={styles.link}>Open goals</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPocketChanges }} style={styles.textButton} onPress={() => setShowPocketChanges(!showPocketChanges)}><Text style={styles.link}>{showPocketChanges ? 'Hide' : 'View'} Pocket changes</Text></Pressable>
        {showPocketChanges && <View>{entries.length === 0 ? <Text style={styles.hint}>No Pocket changes yet.</Text> : entries.slice(0, entryLimit).map((item) => <View style={styles.entry} key={item.id}><View style={styles.entryMain}><Text style={styles.entryText}>{item.kind === 'assign' ? 'Assigned to goal' : item.kind === 'reserve' ? 'Set aside' : 'Lowered Pocket'}</Text><Text style={styles.hint}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={styles.entryText}>{money(item.amountCents)}</Text></View>)}{entryLimit < entries.length && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => setEntryLimit(entryLimit + 10)}><Text style={styles.link}>Show more changes</Text></Pressable>}</View>}
      </View>}
      <PocketTransactions transactions={transactions} />
    </FormScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 20 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.2 },
  balanceCard: { backgroundColor: colors.ink, borderRadius: 20, padding: 22 }, accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  accountName: { color: colors.surface, fontSize: 16, fontWeight: '700' }, balanceLabel: { color: colors.surface, fontSize: 14, lineHeight: 21 },
  balanceMain: { color: colors.surface, fontSize: 46, lineHeight: 56, fontWeight: '800', letterSpacing: -1.6, fontVariant: ['tabular-nums'], marginTop: 4 }, balanceNegative: { color: '#FFB49A' },
  formula: { color: '#C5D5CC', fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 21 },
  pocketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  pocketLabel: { color: colors.lime, fontSize: 14 }, pocketValue: { color: colors.lime, fontWeight: '700', fontSize: 17, fontVariant: ['tabular-nums'] },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 }, currentLabel: { color: '#C5D5CC', fontSize: 12 },
  currentValueGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, currentValue: { color: '#C5D5CC', fontSize: 13, fontVariant: ['tabular-nums'] }, reveal: { color: '#C5D5CC', fontSize: 21 },
  updated: { color: '#C5D5CC', fontSize: 11, lineHeight: 16 }, balanceWarning: { color: '#FFB49A', fontSize: 12, lineHeight: 18, marginTop: 8 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 22 }, action: { flex: 1, alignItems: 'center', gap: 8 },
  actionCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(215,231,167,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.surface, fontSize: 11, lineHeight: 16, fontWeight: '600', textAlign: 'center' }, pressed: { opacity: 0.65 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 18, gap: 12 }, section: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, input: { color: colors.ink, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, padding: 12, minHeight: 46, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { backgroundColor: colors.primary, borderRadius: 7, padding: 13, minHeight: 44, justifyContent: 'center' }, buttonText: { color: colors.surface, fontWeight: '800', fontSize: 13 },
  secondary: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, padding: 13, minHeight: 44, justifyContent: 'center' }, secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 }, textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  entry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderTopColor: colors.line, borderTopWidth: 1 }, entryMain: { flex: 1, gap: 4 }, entryText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
});
