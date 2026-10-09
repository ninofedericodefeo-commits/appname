import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PurchaseCard from '@/features/goals/PurchaseCard';
import { IconButton } from '@/components/IconButton';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

import { formatMoney as money } from '@/lib/money';

function More({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" style={styles.more} onPress={onPress}><Text style={styles.moreText}>{label}</Text></Pressable>;
}

export default function ActivityPanel() {
  const { entries, purchases, archivedGoals, activeGoal, reservedCents, goalSettings } = usePocketStore();
  const [purchaseLimit, setPurchaseLimit] = useState(3);
  const [entryLimit, setEntryLimit] = useState(3);
  const [goalLimit, setGoalLimit] = useState(3);
  const orderedPurchases = [...purchases.filter((item) => item.decision === 'pending'), ...purchases.filter((item) => item.decision !== 'pending')];

  return <View style={styles.content}>
    <View>
      <View style={styles.header}><Text accessibilityRole="header" style={styles.heading}>Activity</Text><IconButton icon="upload" label="Import bank CSV" onPress={() => router.push('/bank-import')} /></View>
      <Text style={styles.hint}>Pocket estimate: {money(reservedCents)}</Text>
    </View>
    <View style={styles.group}>
      <Text style={styles.section}>Purchases ({purchases.length})</Text>
      {purchases.length === 0 && <View style={styles.emptyCard}>
        <View style={styles.header}><Text style={styles.placeholderTitle}>Purchase</Text><Text style={styles.placeholderAmount}>—</Text></View>
        <Text style={styles.hint}>Date · Source · Set aside</Text>
        <Text style={styles.emptyHint}>No purchases yet. Connect Apple Pay, import a bank CSV, or log one in Edit goal.</Text>
      </View>}
      {orderedPurchases.slice(0, purchaseLimit).map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} history={purchases} goal={activeGoal} />)}
      {purchaseLimit < purchases.length && <More label="Show more purchases" onPress={() => setPurchaseLimit((limit) => limit + 5)} />}
      {activeGoal && !goalSettings.suggestionsEnabled && <Text style={styles.hint}>Suggestions are off. You can still choose your own set-aside amount.</Text>}
    </View>
    <View style={styles.card}>
      <Text style={styles.section}>Pocket changes</Text>
      {entries.length === 0 && <View style={styles.entry}>
        <View style={styles.entryMain}><Text style={styles.placeholderTitle}>Change</Text><Text style={styles.hint}>Date · Goal · Purchase</Text><Text style={styles.emptyHint}>No pocket changes yet.</Text></View>
        <Text style={styles.placeholderAmount}>—</Text>
      </View>}
      {entries.slice(0, entryLimit).map((entry) => <View key={entry.id} style={styles.entry}>
        <View style={styles.entryMain}>
          <Text style={styles.entryTitle}>{entry.kind === 'assign' ? 'Assigned existing pocket money' : entry.kind === 'reserve' ? 'Set aside' : 'Lowered pocket'}{entry.goalId ? ' · goal' : ''}</Text>
          <Text style={styles.hint}>{new Date(entry.createdAt).toLocaleString()}{entry.purchaseId ? ' · after purchase' : ''}</Text>
        </View>
        <Text style={styles.amount}>{entry.kind === 'release' ? '−' : entry.kind === 'assign' ? '' : '+'}{money(entry.amountCents)}</Text>
      </View>)}
      {entryLimit < entries.length && <More label="Show more pocket changes" onPress={() => setEntryLimit((limit) => limit + 5)} />}
    </View>
    {archivedGoals.length > 0 && <View style={styles.card}>
      <Text style={styles.section}>Past goals</Text>
      {archivedGoals.slice(0, goalLimit).map((goal) => <View key={goal.id} style={styles.entry}>
        <View style={styles.entryMain}>
          <Text style={styles.entryTitle}>{goal.title}</Text>
          <Text style={styles.hint}>{goal.result === 'reached' ? 'Reached' : 'Ended'} {new Date(goal.endedAt).toLocaleDateString()} · {money(goal.savedCents)} of {money(goal.targetCents)}</Text>
        </View>
      </View>)}
      {goalLimit < archivedGoals.length && <More label="Show more past goals" onPress={() => setGoalLimit((limit) => limit + 5)} />}
    </View>}
    <Link href="/legacy-investment" asChild><Pressable accessibilityRole="button" style={styles.more}><Text style={styles.moreText}>Previous investing demo records ›</Text></Pressable></Link>
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 9, padding: 14 },
  placeholderTitle: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  placeholderAmount: { color: colors.muted, fontSize: 18 },
  emptyHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  heading: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  group: { gap: 9 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 14 },
  entry: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  entryMain: { flex: 1 },
  entryTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  amount: { color: colors.accentDark, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  more: { minHeight: 44, paddingVertical: 10, justifyContent: 'center', alignSelf: 'flex-start' },
  moreText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
