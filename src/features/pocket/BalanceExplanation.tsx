import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { usePocketStore } from '@/stores/pocketStore';
import { accountBalanceEstimate } from './balanceEstimate';
import { formatMoney as money } from '@/lib/money';
import { dataStyles as s } from '../data/styles';
export default function BalanceExplanation() {
  const pocket = usePocketStore(), estimate = accountBalanceEstimate(pocket), [open, setOpen] = useState(false);
  return <View style={s.card}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.choice} onPress={() => setOpen(!open)}><Text style={s.choiceText}>Why this amount? {open ? '⌄' : '›'}</Text></Pressable>{open && <>
    <Text style={s.body}>Confirmed bank balance: {estimate.confirmedCents === null ? 'Not entered' : money(estimate.confirmedCents)}{'\n'}Newer deposits: +{money(estimate.depositsCents)}{'\n'}Newer spending: −{money(estimate.spendingCents)}{'\n'}Money set aside: −{money(pocket.reservedCents)}{'\n'}Available: {estimate.estimatedCents === null ? 'Unknown' : money(estimate.estimatedCents - pocket.reservedCents)}</Text>
    <Text style={s.note}>{estimate.pendingCount} pending bank rows excluded. A statement covers through its closing date; newer posted/logged rows provide only an estimate. Missing purchases or statements can change it. Hiding a row does not change its financial effect.</Text>
    <Link href="/account-review" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Review matches & hidden history ›</Text></Pressable></Link>
  </>}</View>;
}
