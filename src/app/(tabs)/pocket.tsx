import { themedStyles, useThemeRevision , colors } from '@/theme';
import { matchCandidates, bankDuplicateCandidates } from '@/features/pocket/reconciliation';
import BalanceExplanation from '@/features/pocket/BalanceExplanation';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FormScrollView } from '@/components/FormScrollView';
import { PageToolbar } from '@/components/SettingsButton';
import { availableCents, parseBankBalance } from '@/features/pocket/logic';
import { PocketTransactions } from '@/features/pocket/PocketTransactions';
import { annotateRows } from '@/features/pocket/repository';
import { pocketTransactions } from '@/features/pocket/transactions';
import { formatAmount, formatMoney as money } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { accountBalanceEstimate, belongsToLinkedAccount } from '@/features/pocket/balanceEstimate';
import SavingsAdjustmentSheet from '@/features/goals/SavingsAdjustmentSheet';

function AccountAction({ label, path, onPress }: { label: string; path: string; onPress: () => void }) {
  useThemeRevision();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.actionCircle}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#D7E7A7" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d={path} /></Svg></View>
    <Text style={styles.actionLabel}>{label}</Text>
  </Pressable>;
}

export default function PocketScreen() {
  useThemeRevision();
  const pocket = usePocketStore();
  const { linkedBankAccount, reportedBalanceCents, balanceSource, reservedCents, entries, purchases, accountTransactions, hiddenTransactionIds, transactionDirections, transactionDetails, merchantAliases, setReportedBalance } = pocket;
  const [balanceDraft, setBalanceDraft] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [editingPocket, setEditingPocket] = useState(false);
  const [showCurrentBalance, setShowCurrentBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const estimate = accountBalanceEstimate(pocket);
  const available = availableCents(estimate.estimatedCents, reservedCents);
  const availableLabel = available === null ? '—' : money(available);
  const balanceFontSize = availableLabel.length > 9 ? Math.max(28, Math.floor(414 / availableLabel.length)) : 46;
  const balanceInput = balanceDraft ?? (reportedBalanceCents === null ? '' : formatAmount(reportedBalanceCents));
  const transactions = useMemo(() => annotateRows(pocketTransactions(accountTransactions, purchases, entries, hiddenTransactionIds, transactionDirections), transactionDetails, merchantAliases).filter(row => belongsToLinkedAccount(row, linkedBankAccount)), [accountTransactions, purchases, entries, hiddenTransactionIds, transactionDirections, transactionDetails, merchantAliases, linkedBankAccount]);

  const reviewCount = useMemo(() => { const options = { directions: transactionDirections, separateDecisions: pocket.separatePurchaseDecisions, limit: 101 }; return matchCandidates(accountTransactions,purchases,linkedBankAccount, options).length + bankDuplicateCandidates(accountTransactions,linkedBankAccount, options).length; }, [accountTransactions,purchases,linkedBankAccount,transactionDirections,pocket.separatePurchaseDecisions]);
  function updateBalance() {
    const cents = parseBankBalance(balanceInput);
    if (cents === null) { setBalanceError('Enter a balance from −$1,000,000 to $1,000,000 using at most two decimal places.'); return; }
    try { setReportedBalance(cents); } catch (cause) { setBalanceError(cause instanceof Error ? cause.message : 'Could not save this bank balance.'); return; } setBalanceDraft(null); setBalanceError(''); setEditingBalance(false); setShowCurrentBalance(false); Keyboard.dismiss();
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <PageToolbar />
    <FormScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Account</Text>
      <View style={styles.balanceCard}>
        <View style={styles.accountHeading}><View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#D7E7A7" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 7V5h14v3M4 7h16v14H4V7Zm12 6h4v4h-4v-4Z" /></Svg></View><Text style={styles.accountName}>{linkedBankAccount?.nickname ?? pocket.bankImportAccountLabel}</Text></View>
        <Text style={styles.balanceLabel}>{estimate.newerCount ? 'Estimated available to spend' : 'Available to spend'}</Text>
        {!!estimate.snapshotDay && <Text style={styles.snapshot}>{balanceSource === 'citizens-pdf' ? 'Statement balance from' : 'Bank balance checked'} {new Date(`${estimate.snapshotDay}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
        <Text accessibilityLabel={available === null ? 'Available to spend: add your bank balance' : `Available to spend: ${money(available)}`} style={[styles.balanceMain, { fontSize: balanceFontSize }, available !== null && available < 0 && styles.balanceNegative]} >{availableLabel}</Text>
        <Text style={styles.formula}>{available === null ? 'Add your current bank balance to get started.' : estimate.newerCount ? `Bank balance + ${estimate.newerCount} newer update${estimate.newerCount === 1 ? '' : 's'} − money set aside` : 'Saved bank balance minus money set aside'}</Text>
        <View style={styles.pocketRow}><Text style={styles.pocketLabel}>Set aside</Text><Text style={styles.pocketValue}>{money(reservedCents)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={showCurrentBalance ? 'Hide last bank balance' : 'Show last bank balance'} accessibilityState={{ expanded: showCurrentBalance }} onPress={() => setShowCurrentBalance(!showCurrentBalance)} style={styles.currentRow}>
          <Text style={styles.currentLabel}>Last bank balance</Text>
          <View style={styles.currentValueGroup}><Text style={styles.currentValue}>{showCurrentBalance ? (reportedBalanceCents === null ? 'Not entered' : money(reportedBalanceCents)) : 'Show'}</Text><Text style={styles.reveal}>{showCurrentBalance ? '⌄' : '›'}</Text></View>
        </Pressable>
        {estimate.newerCount > 0 && <Text style={styles.updated}>{estimate.deltaCents < 0 ? '−' : '+'}{money(Math.abs(estimate.deltaCents))} from posted/logged activity since that balance. Unlogged activity may be missing.</Text>}
        {estimate.pendingCount > 0 && <Text style={styles.updated}>{estimate.pendingCount} pending bank transaction{estimate.pendingCount === 1 ? '' : 's'} excluded from this estimate.</Text>}
        {available !== null && available < 0 && <Text accessibilityRole="alert" style={styles.balanceWarning}>{estimate.estimatedCents !== null && estimate.estimatedCents < 0 ? 'Your estimated bank balance is below $0. Check it against your bank before setting aside more.' : 'Your set-aside amount is above your estimated bank balance. Update the balance or lower your set-aside amount.'}</Text>}
        <View style={styles.accountActions}>
          <AccountAction label="Update balance" path="m16 3 5 5M3 21l5-1L20 8a3.54 3.54 0 0 0-5-5L3 15v6Z" onPress={() => { Keyboard.dismiss(); setEditingBalance(!editingBalance); setEditingPocket(false); }} />
          <AccountAction label="Manage savings" path="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" onPress={() => { Keyboard.dismiss(); setEditingPocket(true); setEditingBalance(false); }} />
          <AccountAction label="Import statement" path="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" onPress={() => router.push('/bank-import')} />
        </View>
      </View>
      {editingBalance && <View style={styles.card}>
        <Text style={styles.section}>Update bank balance</Text><Text style={styles.hint}>Copy the current balance from your bank app.</Text>
        <TextInput value={balanceInput} onChangeText={setBalanceDraft} style={styles.input} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="Account balance" />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: /^[-−]/.test(balanceInput.trim()) }} aria-checked={/^[-−]/.test(balanceInput.trim())} style={styles.secondary} onPress={() => { const value = balanceInput.trim(); setBalanceDraft(/^[-−]/.test(value) ? value.slice(1) : `-${value.replace(/^\+/, '')}`); setBalanceError(''); }}><Text style={styles.secondaryText}>{/^[-−]/.test(balanceInput.trim()) ? '✓ ' : ''}Overdrawn / negative bank balance</Text></Pressable>
        <Text style={styles.hint}>Enable for a balance below $0. This does not change your money set aside.</Text>
        {balanceError ? <Text accessibilityRole="alert" style={styles.error}>{balanceError}</Text> : null}
        <View style={styles.row}><Pressable accessibilityRole="button" style={styles.button} onPress={updateBalance}><Text style={styles.buttonText}>Save balance</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { Keyboard.dismiss(); setEditingBalance(false); }}><Text style={styles.secondaryText}>Close</Text></Pressable></View>
      </View>}
      {editingPocket && <SavingsAdjustmentSheet initialDestination="unassigned" onClose={() => setEditingPocket(false)} />}
      <BalanceExplanation />
      {reviewCount > 0 && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/account-review')}><Text style={styles.secondaryText}>Review {reviewCount > 100 ? '100+' : reviewCount} possible transaction match{reviewCount === 1 ? '' : 'es'} ›</Text><Text style={styles.hint}>Similar charges stay separate until reviewed.</Text></Pressable>}
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/insights')}><Text style={styles.secondaryText}>Spending insights & exports ›</Text></Pressable>
      <PocketTransactions transactions={transactions} />
      <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => router.push('/bank-imports')}><Text style={styles.link}>Saved imports ›</Text></Pressable>
    </FormScrollView>
  </SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 20 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.2 },
  balanceCard: { backgroundColor: '#173A35', borderRadius: 20, padding: 22 }, accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  accountName: { color: '#FFFEF9', fontSize: 16, fontWeight: '700' }, balanceLabel: { color: '#FFFEF9', fontSize: 14, lineHeight: 21 },
  balanceMain: { color: '#FFFEF9', fontSize: 46, lineHeight: 56, fontWeight: '800', letterSpacing: -1.6, fontVariant: ['tabular-nums'], marginTop: 4 }, balanceNegative: { color: '#FFB49A' },
  snapshot: { color: '#D7E7A7', fontSize: 12, lineHeight: 18, marginTop: 5 },
  formula: { color: '#C5D5CC', fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 21 },
  pocketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  pocketLabel: { color: '#D7E7A7', fontSize: 14 }, pocketValue: { color: '#D7E7A7', fontWeight: '700', fontSize: 17, fontVariant: ['tabular-nums'] },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 }, currentLabel: { color: '#C5D5CC', fontSize: 12 },
  currentValueGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, currentValue: { color: '#C5D5CC', fontSize: 13, fontVariant: ['tabular-nums'] }, reveal: { color: '#C5D5CC', fontSize: 21 },
  updated: { color: '#C5D5CC', fontSize: 11, lineHeight: 16 }, balanceWarning: { color: '#FFB49A', fontSize: 12, lineHeight: 18, marginTop: 8 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 22 }, action: { flex: 1, alignItems: 'center', gap: 8 },
  actionCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(215,231,167,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#FFFEF9', fontSize: 11, lineHeight: 16, fontWeight: '600', textAlign: 'center' }, pressed: { opacity: 0.65 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 18, gap: 12 }, section: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, input: { color: colors.ink, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, padding: 12, minHeight: 46, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { backgroundColor: colors.primary, borderRadius: 7, padding: 13, minHeight: 44, justifyContent: 'center' }, buttonText: { color: colors.surface, fontWeight: '800', fontSize: 13 },
  secondary: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, padding: 13, minHeight: 44, justifyContent: 'center' }, secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 }, textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
}));
