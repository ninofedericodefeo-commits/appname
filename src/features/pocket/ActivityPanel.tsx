import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PurchaseCard from '@/features/goals/PurchaseCard';
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
      <Text accessibilityRole="header" style={styles.heading}>Activity</Text>
      <Text style={styles.hint}>Pocket estimate: {money(reservedCents)} earmarked. Purchases and changes stay on this device.</Text>
    </View>
    {purchases.length > 0 && <View style={styles.group}>
      <Text style={styles.section}>Purchases ({purchases.length})</Text>
      {orderedPurchases.slice(0, purchaseLimit).map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} history={purchases} goal={activeGoal} />)}
      {purchaseLimit < purchases.length && <More label="Show more purchases" onPress={() => setPurchaseLimit((limit) => limit + 5)} />}
      {activeGoal && !goalSettings.suggestionsEnabled && <Text style={styles.hint}>Suggestions are off. You can still choose your own set-aside amount.</Text>}
    </View>}
    {entries.length > 0 && <View style={styles.card}>
      <Text style={styles.section}>Pocket changes</Text>
      {entries.slice(0, entryLimit).map((entry) => <View key={entry.id} style={styles.entry}>
        <View style={styles.entryMain}>
          <Text style={styles.entryTitle}>{entry.kind === 'assign' ? 'Assigned existing pocket money' : entry.kind === 'reserve' ? 'Set aside' : 'Lowered pocket'}{entry.goalId ? ' · goal' : ''}</Text>
          <Text style={styles.hint}>{new Date(entry.createdAt).toLocaleString()}{entry.purchaseId ? ' · after purchase' : ''}</Text>
        </View>
        <Text style={styles.amount}>{entry.kind === 'release' ? '−' : entry.kind === 'assign' ? '' : '+'}{money(entry.amountCents)}</Text>
      </View>)}
      {entryLimit < entries.length && <More label="Show more pocket changes" onPress={() => setEntryLimit((limit) => limit + 5)} />}
    </View>}
    {purchases.length === 0 && entries.length === 0 && <Text style={styles.hint}>Your purchases and pocket changes will appear here.</Text>}
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
