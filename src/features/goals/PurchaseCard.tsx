import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { suggestAmounts } from '@/features/goals/logic';
import type { Goal, LoggedPurchase } from '@/features/goals/logic';
import { parseDollars } from '@/features/pocket/logic';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

import { formatAmount, formatMoney as money } from '@/lib/money';

function Action({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]}>
    <Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text>
  </Pressable>;
}

export default function PurchaseCard({ purchase, history, goal }: { purchase: LoggedPurchase; history: LoggedPurchase[]; goal: Goal | null }) {
  const { goalSettings, reserveForGoal, skipPurchase, updatePurchase, removePurchase, reportedBalanceCents, reservedCents } = usePocketStore();
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(purchase.title);
  const [editAmount, setEditAmount] = useState(formatAmount(purchase.amountCents));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [showActions, setShowActions] = useState(purchase.decision === 'pending');
  const suggestion = goal && purchase.decision === 'pending' ? suggestAmounts({ purchase, history, goal, settings: goalSettings }) : { amounts: [], sparse: false, paceLimited: false };
  const available = reportedBalanceCents === null ? null : reportedBalanceCents - reservedCents;

  function save(cents: number) {
    if (cents <= 0 || !reserveForGoal(cents, purchase.id)) {
      setError('Could not set this amount aside. Check your target and estimated available balance.');
      return;
    }
    setError('');
  }

  return <View style={styles.card}>
    <View style={styles.rowBetween}><Text style={styles.section}>{purchase.title}</Text><Text style={styles.amount}>{money(purchase.amountCents)}</Text></View>
    <Text style={styles.hint}>{purchase.source === 'shortcut' ? 'Apple Pay Shortcut' : purchase.source === 'bank-import' ? (purchase.bankSource === 'citizens-pdf' ? 'Citizens PDF' : 'Bank CSV') : 'Logged'} · {new Date(purchase.purchasedAt).toLocaleDateString()} · {purchase.decision === 'saved' ? `${money(purchase.savedCents ?? 0)} set aside` : purchase.decision === 'skipped' ? 'No set-aside' : goal ? 'Choose a set-aside amount' : 'Awaiting a goal'}</Text>
    {purchase.decision === 'pending' && goal && <>
      {goalSettings.suggestionsEnabled && suggestion.amounts.length > 0 && <><Text style={styles.label}>Suggested set-aside amounts</Text><View style={styles.row}>{suggestion.amounts.map((amount, index) => <Action key={amount} label={`${['Small', 'Medium', 'Faster'][index] ?? 'Save'} ${money(amount)}`} secondary onPress={() => save(amount)} />)}</View></>}
      {suggestion.sparse && goalSettings.suggestionsEnabled && <Text style={styles.hint}>Starting suggestion: 5% of this purchase. Suggestions will adapt after three logged purchases.</Text>}
      {suggestion.paceLimited && <Text style={styles.hint}>At this limit, the goal may take longer than the target date.</Text>}
      {available !== null && available < 1 && <Text style={styles.hint}>Your entered balance leaves no estimated amount available to set aside. Update it in Savings pocket.</Text>}
      <Text style={styles.label}>Or choose your own amount</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={custom} onChangeText={setCustom} placeholder="2.00" keyboardType="decimal-pad" accessibilityLabel={`Custom set-aside for ${purchase.title}`} /><Action label="Set aside" onPress={() => { const cents = parseDollars(custom); if (cents === null) setError('Enter a valid dollar amount.'); else save(cents); }} /><Action label="Skip" secondary onPress={() => skipPurchase(purchase.id)} /></View>
    </>}
    {!showActions && <Action label="Edit / delete" secondary onPress={() => setShowActions(true)} />}
    {showActions && <View style={styles.row}><Action label={editing ? 'Cancel edit' : 'Edit purchase'} secondary onPress={() => setEditing(!editing)} /><Action label="Delete purchase" secondary onPress={() => setConfirmRemove(true)} /></View>}
    {editing && <View><Text style={styles.label}>Purchase title</Text><TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} maxLength={80} accessibilityLabel="Edit purchase title" /><Text style={styles.label}>Actual amount</Text><TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" accessibilityLabel="Edit purchase amount" /><Action label="Save purchase" onPress={() => { const cents = parseDollars(editAmount); if (cents === null || !updatePurchase(purchase.id, editTitle, cents)) setError('Enter a title and an amount greater than $0.'); else { setEditing(false); setError(''); } }} /><Text style={styles.hint}>Editing a purchase never changes money already set aside.</Text></View>}
    {confirmRemove && <View style={styles.warning}><Text style={styles.hint}>Delete this purchase? Any confirmed set-aside stays in your pocket.</Text><View style={styles.row}><Action label="Delete" onPress={() => removePurchase(purchase.id)} /><Action label="Cancel" secondary onPress={() => setConfirmRemove(false)} /></View></View>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 14, gap: 8 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  amount: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 6, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  shortInput: { minWidth: 100, flexGrow: 1 },
  action: { alignSelf: 'flex-start', backgroundColor: colors.accentDark, borderRadius: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  actionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  actionText: { color: colors.surface, fontWeight: '800', fontSize: 13 },
  actionSecondaryText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  warning: { backgroundColor: colors.paleOrange, borderRadius: 8, padding: 12, gap: 8 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
