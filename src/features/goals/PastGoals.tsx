import { SamplePastGoalsPreview } from '@/features/samples/SampleActivityPreviews';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePocketStore } from '@/stores/pocketStore';
import { formatMoney } from '@/lib/money';

export default function PastGoals() {
  useThemeRevision();
  const goals = usePocketStore((state) => state.archivedGoals);
  const [limit, setLimit] = useState(3);
  return <View style={styles.section}>
    <SamplePastGoalsPreview />
    {goals.length > 0 && <>
      <Text accessibilityRole="header" style={styles.title}>Past goals</Text>
      {goals.slice(0, limit).map((goal) => <View key={goal.id} style={styles.card}><Text style={styles.name}>{goal.title}</Text><Text style={styles.note}>{goal.result === 'reached' ? 'Reached' : 'Ended'} {new Date(goal.endedAt).toLocaleDateString()} · {formatMoney(goal.savedCents)} of {formatMoney(goal.targetCents)}</Text></View>)}
      {limit < goals.length && <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => setLimit(limit + 5)}><Text style={styles.link}>Show more past goals</Text></Pressable>}
    </>}
  </View>;
}
const styles = themedStyles(() => ({
  section: { gap: 10 }, title: { color: colors.ink, fontSize: 22, fontWeight: '800' }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14, gap: 6 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, linkButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
}));
