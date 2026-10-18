import { Text, View } from 'react-native';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import { formatMoney } from '@/lib/money';
import { nextRenewal } from '@/features/subscriptions/logic';
import { sampleGoal, withSampleSubscriptions } from './fixtures';

export function SampleGoalPreview() {
  useThemeRevision();
  const goal = sampleGoal();
  return <View style={styles.card}>
    <Text style={styles.badge}>SAMPLE · PREVIEW ONLY</Text>
    <Text accessibilityRole="header" style={styles.heading}>{goal.title}</Text>
    <Text style={styles.amount}>{formatMoney(goal.savedCents)} <Text style={styles.note}>of {formatMoney(goal.targetCents)}</Text></Text>
    <View accessibilityLabel={`${Math.round(goal.savedCents / goal.targetCents * 100)} percent of sample goal saved`} style={styles.track}>
      <View style={[styles.fill, { width: `${goal.savedCents / goal.targetCents * 100}%` }]} />
    </View>
    <Text style={styles.note}>Invented progress. No money is set aside, and your real goal stays unchanged.</Text>
  </View>;
}

export function SampleSubscriptionPreviews({ today }: { today: Date }) {
  useThemeRevision();
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.heading}>Sample subscriptions</Text>
    <Text style={styles.note}>Invented services for previewing renewals. Excluded from your costs, reminders and bank matching.</Text>
    {withSampleSubscriptions([], true, today).map(subscription => <View key={subscription.id} style={styles.card}>
      <Text style={styles.badge}>SAMPLE · PREVIEW ONLY</Text>
      <View style={styles.row}><Text style={styles.name}>{subscription.name}</Text><Text style={styles.price}>{formatMoney(subscription.amountCents)}</Text></View>
      <Text style={styles.note}>{subscription.cadence === 'monthly' ? 'Monthly' : 'Yearly'} · Sample renewal {nextRenewal(subscription, today).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
    </View>)}
  </View>;
}
const styles = themedStyles(() => ({
  group: { gap: 12 }, card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  badge: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  amount: { color: colors.ink, fontSize: 28, lineHeight: 35, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.line },
  fill: { height: 8, backgroundColor: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '600', flexGrow: 1, flexShrink: 1 },
  price: { color: colors.ink, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
}));
