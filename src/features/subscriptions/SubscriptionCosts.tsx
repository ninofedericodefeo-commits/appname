import { colors, themedStyles, useThemeRevision } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';
import { subscriptionCosts } from './logic';
import type { Subscription } from './logic';
import { formatMoney } from '@/lib/money';
export default function SubscriptionCosts({ subscriptions, today }: { subscriptions: Subscription[]; today: Date }) {
  useThemeRevision();
  const cost = subscriptionCosts(subscriptions, today);
  const monthlyLabel = formatMoney(cost.monthlyEquivalentCents);
  const totalFontSize = monthlyLabel.length > 9 ? Math.max(23, Math.floor(300 / monthlyLabel.length)) : 38;
  return <View style={styles.card}>
    <Text style={styles.label}>Monthly equivalent</Text>
    <Text accessibilityRole="header" accessibilityLabel={`Approximate monthly equivalent: ${monthlyLabel}`} style={[styles.total, { fontSize: totalFontSize }]}>≈ {monthlyLabel}</Text>
    <View style={styles.row}>{[
      ['Next 7 days', cost.next7Cents], ['Next 30 days', cost.next30Cents],
    ].map(([label, cents]) => <View key={label} style={styles.metric}><Text style={styles.note}>{label}</Text><Text style={styles.amount}>{formatMoney(Number(cents))}</Text></View>)}</View>
    <View style={styles.annual}><Text style={styles.note}>Annual run rate</Text><Text style={styles.annualAmount}>{formatMoney(cost.annualCents)}</Text></View>
    <Text style={styles.note}>{cost.activeCount} real active subscriptions. Samples and canceled items are excluded. Annual bills are divided by 12 only in the monthly equivalent. Plans to cancel remain included until confirmed. Trials use the expected first paid date.</Text>
  </View>;
}

const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  label: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  total: { color: colors.ink, fontSize: 38, lineHeight: 48, letterSpacing: -1, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 4 },
  metric: { minWidth: '40%', flex: 1, gap: 4 },
  amount: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  annual: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  annualAmount: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
}));
