import { colors } from '@/theme';
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseDollars } from '@/features/pocket/logic';
import { usePocketStore } from '@/stores/pocketStore';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ActivityScreen() {
  const { entries, purchases, archivedGoals, activeGoal, reservedCents, updatePurchase, removePurchase } = usePocketStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function saveEdit() {
    if (!editingId) return;
    const cents = parseDollars(amount);
    if (cents === null || !updatePurchase(editingId, title, cents)) { setError('Enter a title and an amount greater than $0.'); return; }
    setEditingId(null);
    setError('');
  }
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>SAVINGS</Text>
    <Text style={styles.title}>Savings activity</Text>
    <View style={styles.notice}><Text style={styles.noticeTitle}>On-device estimate</Text><Text style={styles.hint}>Purchases are logged manually or through an optional Apple Pay Shortcut. Goal rules can update the pocket estimate. The app does not verify your account balance or move money.</Text><Text style={styles.total}>{money(reservedCents)} earmarked in pocket</Text>{activeGoal && <Text style={styles.hint}>{money(activeGoal.savedCents)} assigned to {activeGoal.title}</Text>}</View>
    <View style={styles.card}><Text style={styles.section}>Pocket changes</Text>{entries.length === 0 ? <Text style={styles.hint}>No pocket changes yet.</Text> : entries.map((entry) => <View key={entry.id} style={styles.entry}><View style={styles.entryMain}><Text style={styles.entryTitle}>{entry.kind === 'assign' ? 'Assigned existing pocket money' : entry.kind === 'reserve' ? 'Set aside' : 'Lowered pocket'}{entry.goalId ? ' · goal' : ''}</Text><Text style={styles.hint}>{new Date(entry.createdAt).toLocaleString()}{entry.purchaseId ? ' · after purchase' : ''}</Text></View><Text style={styles.amount}>{entry.kind === 'release' ? '−' : entry.kind === 'assign' ? '' : '+'}{money(entry.amountCents)}</Text></View>)}</View>
    <View style={styles.card}><Text style={styles.section}>Logged purchases</Text>{purchases.length === 0 ? <Text style={styles.hint}>No purchases logged yet.</Text> : purchases.map((purchase) => <View key={purchase.id} style={styles.entry}><View style={styles.entryMain}><Text style={styles.entryTitle}>{purchase.title} · {money(purchase.amountCents)}</Text><Text style={styles.hint}>{new Date(purchase.purchasedAt).toLocaleDateString()} · {purchase.source === 'shortcut' ? 'Apple Pay Shortcut · ' : ''}{purchase.decision === 'saved' ? `${money(purchase.savedCents ?? 0)} set aside` : purchase.decision === 'skipped' ? 'Skipped set-aside' : 'Awaiting decision'}</Text><View style={styles.row}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => { setEditingId(purchase.id); setTitle(purchase.title); setAmount((purchase.amountCents / 100).toFixed(2)); setError(''); }}><Text style={styles.smallText}>Edit</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setPendingDeleteId(purchase.id)}><Text style={styles.smallText}>Delete</Text></Pressable></View>{editingId === purchase.id && <View style={styles.editor}><TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={80} accessibilityLabel="Edit purchase name" /><TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Edit purchase amount" /><View style={styles.row}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={saveEdit}><Text style={styles.smallText}>Save</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setEditingId(null)}><Text style={styles.smallText}>Cancel</Text></Pressable></View><Text style={styles.hint}>Editing this purchase leaves confirmed set-asides unchanged.</Text></View>}{pendingDeleteId === purchase.id && <View style={styles.editor}><Text style={styles.hint}>Delete this purchase? Confirmed set-asides remain in the pocket.</Text><View style={styles.row}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => { removePurchase(purchase.id); setPendingDeleteId(null); }}><Text style={styles.smallText}>Delete purchase</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setPendingDeleteId(null)}><Text style={styles.smallText}>Cancel</Text></Pressable></View></View>}</View></View>)}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {archivedGoals.length > 0 && <View style={styles.card}><Text style={styles.section}>Past goals</Text>{archivedGoals.map((goal) => <View key={goal.id} style={styles.entry}><View style={styles.entryMain}><Text style={styles.entryTitle}>{goal.title}</Text><Text style={styles.hint}>{goal.result === 'reached' ? 'Reached' : 'Ended'} {new Date(goal.endedAt).toLocaleDateString()} · {money(goal.savedCents)} of {money(goal.targetCents)}</Text></View></View>)}</View>}
    <Link href="/legacy-investment" asChild><Pressable accessibilityRole="button" style={styles.legacy}><Text style={styles.legacyText}>Previous investing demo records</Text></Pressable></Link>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 44, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 }, nav: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, justifyContent: 'center' }, navText: { color: colors.surface, fontWeight: '700' },
  notice: { backgroundColor: colors.paleGreen, borderLeftColor: colors.primary, borderLeftWidth: 4, padding: 18, gap: 6 }, noticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, total: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 }, card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 18 }, section: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 9 }, entry: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingVertical: 13, borderTopColor: colors.line, borderTopWidth: 1 }, entryMain: { flex: 1 }, entryTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' }, amount: { color: colors.accentDark, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }, legacy: { padding: 14, alignSelf: 'center' }, legacyText: { color: colors.inkSoft, fontWeight: '700' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }, smallButton: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: 'center' }, smallText: { color: colors.ink, fontSize: 12, fontWeight: '700' }, editor: { marginTop: 8, gap: 8 }, input: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 11, paddingVertical: 10, minHeight: 44 }, error: { color: colors.danger, fontSize: 13 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 1 },
});
