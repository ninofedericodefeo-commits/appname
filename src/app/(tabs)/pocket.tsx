import SampleAccountPreview from '@/features/samples/SampleAccountPreview';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { matchCandidates, bankDuplicateCandidates } from '@/features/pocket/reconciliation';
import BalanceExplanation from '@/features/pocket/BalanceExplanation';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FormScrollView } from '@/components/FormScrollView';
import { AppIcon } from '@/components/AppIcon';
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
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.actionCircle}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={path} /></Svg></View>
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
      <SampleDataControl onPreviewStatement={() => router.push('/sample-statement')} />
      <View style={styles.balanceCard}>
        <View style={styles.accountHeading}><AppIcon name="wallet" color={colors.primary} /><Text style={styles.accountName}>{linkedBankAccount?.nickname ?? pocket.bankImportAccountLabel}</Text></View>
        <Text style={styles.balanceLabel}>{estimate.newerCount ? 'Estimated available to spend' : 'Available to spend'}</Text>
        {!!estimate.snapshotDay && <Text style={styles.snapshot}>{balanceSource === 'citizens-pdf' ? 'Statement balance from' : 'Bank balance checked'} {new Date(`${estimate.snapshotDay}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
        <Text accessibilityLabel={available === null ? 'Available to spend: add your bank balance' : `Available to spend: ${money(available)}`} style={[styles.balanceMain, { fontSize: balanceFontSize }, available !== null && available < 0 && styles.balanceNegative]} >{availableLabel}</Text>
        <Text style={styles.formula}>{available === null ? 'Add your current bank balance to get started.' : estimate.newerCount ? `Bank balance + ${estimate.newerCount} newer update${estimate.newerCount === 1 ? '' : 's'} − money set aside` : 'Saved bank balance minus money set aside'}</Text>
        <View style={styles.pocketRow}><Text style={styles.pocketLabel}>Set aside</Text><Text style={styles.pocketValue}>{money(reservedCents)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={showCurrentBalance ? 'Hide last bank balance' : 'Show last bank balance'} accessibilityState={{ expanded: showCurrentBalance }} onPress={() => setShowCurrentBalance(!showCurrentBalance)} style={styles.currentRow}>
          <Text style={styles.currentLabel}>Last bank balance</Text>
          <View style={styles.currentValueGroup}><Text style={styles.currentValue}>{showCurrentBalance ? (reportedBalanceCents === null ? 'Not entered' : money(reportedBalanceCents)) : 'Show'}</Text><AppIcon name={showCurrentBalance ? 'chevron-down' : 'chevron-right'} size={17} color={colors.primary} /></View>
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
      <SampleAccountPreview />
      <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => router.push('/bank-imports')}><Text style={styles.link}>Saved imports ›</Text></Pressable>
    </FormScrollView>
  </SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32, gap: 20 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.8 },
  balanceCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20 }, accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  accountName: { color: colors.inkSoft, fontSize: 15, fontWeight: '600', flexShrink: 1 }, balanceLabel: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  balanceMain: { color: colors.ink, fontSize: 46, lineHeight: 58, fontWeight: '700', letterSpacing: -1.6, fontVariant: ['tabular-nums'], marginTop: 4 }, balanceNegative: { color: colors.danger },
  snapshot: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  formula: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 22 },
  pocketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pocketLabel: { color: colors.inkSoft, fontSize: 15 }, pocketValue: { color: colors.ink, fontWeight: '600', fontSize: 17, fontVariant: ['tabular-nums'] },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 12 }, currentLabel: { color: colors.muted, fontSize: 13 },
  currentValueGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 }, currentValue: { color: colors.primary, fontSize: 14, fontVariant: ['tabular-nums'] },
  updated: { color: colors.muted, fontSize: 12, lineHeight: 18 }, balanceWarning: { color: colors.danger, fontSize: 13, lineHeight: 20, marginTop: 8 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 22 }, action: { flex: 1, minWidth: 44, minHeight: 80, alignItems: 'center', gap: 8 },
  actionCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' }, pressed: { opacity: 0.65 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, gap: 12 }, section: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 }, input: { color: colors.ink, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 48, fontSize: 17 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, minHeight: 48, justifyContent: 'center' }, buttonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
  secondary: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, minHeight: 48, justifyContent: 'center', gap: 4 }, secondaryText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 }, textButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontWeight: '600', fontSize: 15 },
}));
