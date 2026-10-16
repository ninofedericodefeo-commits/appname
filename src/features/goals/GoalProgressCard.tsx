import { themedStyles, useThemeRevision } from '@/theme';
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { progressPercent } from '@/features/goals/logic';
import { parseAmazonLink } from '@/features/goals/amazonLink';
import type { Goal } from '@/features/goals/logic';
import { formatCompactMoney, formatMoney } from '@/lib/money';

export default function GoalProgressCard({ goal, onEdit, editing }: {
  goal: Goal; onEdit: () => void; editing: boolean;
}) {
  useThemeRevision();
  const [showRemaining, setShowRemaining] = useState(false);
  const percent = progressPercent(goal);
  const productLink = goal.product ? parseAmazonLink(goal.product.sourceUrl).value : null;
  return <View style={styles.card}>
    <View style={styles.top}>
      <Text style={styles.date}>{goal.deadline ? new Date(`${goal.deadline}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</Text>
      <View style={styles.actions}>
        {editing ? <Text style={styles.date}>Editing below</Text> : <IconButton icon="edit" label="Edit goal" inverse onPress={onEdit} />}
      </View>
    </View>
    <Text accessibilityRole="header" style={styles.title}>{goal.title}</Text>
    {goal.product && productLink && <View style={styles.product}>
      {goal.product.variant ? <Text style={styles.date}>{goal.product.variant}</Text> : null}
      <Link href={productLink.sourceUrl} target="_blank" asChild><Pressable accessibilityRole="link" accessibilityLabel="View goal product on Amazon" style={styles.productLink}><Text style={styles.productText}>View on Amazon ↗</Text></Pressable></Link>
    </View>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${formatMoney(goal.savedCents)} of ${formatMoney(goal.targetCents)}`}
      accessibilityHint="Show or hide the amount left" accessibilityState={{ expanded: showRemaining }}
      onPress={() => setShowRemaining(!showRemaining)} style={styles.totalButton}>
      <Text style={styles.saved} >
        {formatCompactMoney(goal.savedCents)}<Text style={styles.target}> / {formatCompactMoney(goal.targetCents)}</Text>
      </Text>
    </Pressable>
    {showRemaining && <Text accessibilityLiveRegion="polite" style={styles.remaining}>{formatCompactMoney(Math.max(0, goal.targetCents - goal.savedCents))} left</Text>}
    <View style={styles.progress}>
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel="Goal progress" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.percent}>{percent}%</Text>
    </View>
  </View>;
}

const styles = themedStyles(() => ({
  card: { backgroundColor: '#173A35', borderRadius: 15, padding: 20, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { color: '#D7E7A7', fontSize: 12, flex: 1 },
  actions: { flexWrap: 'wrap', flexDirection: 'row', gap: 6 },
  title: { color: '#FFFEF9', fontSize: 22, fontWeight: '700', lineHeight: 29 },
  product: { gap: 4 }, productLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, productText: { color: '#D7E7A7', fontSize: 13, fontWeight: '700' },
  totalButton: { minHeight: 54, justifyContent: 'center', paddingVertical: 6 },
  saved: { color: '#FFFEF9', fontSize: 37, lineHeight: 47, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  target: { color: '#D7E7A7', fontSize: 25, fontWeight: '500', letterSpacing: -0.5 },
  remaining: { color: '#D7E7A7', fontSize: 14, paddingBottom: 4 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 7 },
  bar: { flex: 1, height: 7, backgroundColor: '#38574F', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#D7E7A7' },
  percent: { color: '#D7E7A7', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
}));
