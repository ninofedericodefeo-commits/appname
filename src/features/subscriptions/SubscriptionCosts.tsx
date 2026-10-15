import { Text, View } from 'react-native';
import { subscriptionCosts } from './logic';
import type { Subscription } from './logic';
import { formatMoney } from '@/lib/money';
import { dataStyles as s } from '@/features/data/styles';
export default function SubscriptionCosts({ subscriptions, today }: { subscriptions: Subscription[]; today: Date }) {
  const cost = subscriptionCosts(subscriptions, today);
  return <View style={s.card}><Text style={s.heading}>Your subscription costs</Text><View style={s.row}>{[
    ['Next 7 days', cost.next7Cents], ['Next 30 days', cost.next30Cents], ['Monthly equivalent ≈', cost.monthlyEquivalentCents], ['Annual run rate', cost.annualCents],
  ].map(([label, cents]) => <View key={label} style={{ minWidth: '45%', flex: 1, gap: 3, paddingVertical: 6 }}><Text style={s.note}>{label}</Text><Text style={s.heading}>{formatMoney(Number(cents))}</Text></View>)}</View><Text style={s.note}>{cost.activeCount} real active subscriptions. Samples and canceled items are excluded. Annual bills are divided by 12 only in the monthly equivalent. Plans to cancel remain included until confirmed. Trials use the expected first paid date.</Text></View>;
}
