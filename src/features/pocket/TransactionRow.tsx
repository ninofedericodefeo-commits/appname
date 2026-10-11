import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PurchaseCard from '@/features/goals/PurchaseCard';
import { usePocketStore } from '@/stores/pocketStore';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme';
import type { PocketTransaction } from './transactions';
import { transactionDisplayName } from './transactions';

const sourceNames = { 'citizens-pdf': 'Citizens statement', csv: 'Bank CSV', manual: 'Manually logged', shortcut: 'Apple Pay Shortcut', savings: 'Savings adjustment' };
const statusNames = { posted: 'Posted', pending: 'Pending', recorded: 'Imported', logged: 'Logged', adjustment: 'Local only' };

export function TransactionRow({ transaction }: { transaction: PocketTransaction }) {
  const purchases = usePocketStore((state) => state.purchases);
  const activeGoal = usePocketStore((state) => state.activeGoal);
  const adjustment = transaction.source === 'savings';
  const [expanded, setExpanded] = useState(false);
  const incoming = !adjustment && transaction.amountCents > 0;
  const outgoing = !adjustment && transaction.amountCents < 0;
  const title = transactionDisplayName(transaction);
  const amount = `${adjustment ? '' : incoming ? '+' : '−'}${formatMoney(Math.abs(transaction.amountCents))}`;
  const date = new Date(transaction.occurredAt);
  const shortDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const initials = title.replace(/[^a-z0-9 ]/gi, '').trim().slice(0, 2).toUpperCase();
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${amount}, ${shortDate}. ${expanded ? 'Hide' : 'Show'} transaction details`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.avatar, incoming && styles.creditAvatar, outgoing && styles.debitAvatar]}><Text style={[styles.initials, outgoing && styles.debit]}>{adjustment ? '↔' : incoming ? '+' : initials || '↗'}</Text></View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.meta}>{shortDate}{adjustment ? ' · Savings' : transaction.status === 'pending' ? ' · Pending' : transaction.purchase?.decision === 'pending' ? ' · Savings review' : ''}</Text>
      </View>
      <Text style={[styles.amount, incoming && styles.credit, outgoing && styles.debit]}>{amount}</Text>
      <Text style={styles.chevron}>{expanded ? '⌄' : '›'}</Text>
    </Pressable>
    {expanded && <View style={styles.details}>
      <Text style={styles.detailText}>{sourceNames[transaction.source]} · {statusNames[transaction.status]}</Text>
      {transaction.accountLabel ? <Text style={styles.detailText}>{transaction.accountLabel}</Text> : null}
      <Text style={styles.detailText}>{transaction.title}</Text>
      {adjustment && <Text style={styles.detailText}>Changes what is set aside. Money stays in your bank account.</Text>}
      {transaction.purchase && (transaction.purchase.title !== transaction.title || transaction.purchase.amountCents !== Math.abs(transaction.amountCents)) && <Text style={styles.detailText}>Savings record: {transaction.purchase.title} · {formatMoney(transaction.purchase.amountCents)}</Text>}
      {transaction.purchase && <PurchaseCard purchase={transaction.purchase} history={purchases} goal={activeGoal} compact />}
      {transaction.status === 'recorded' && <Text style={styles.detailText}>Posting status wasn’t included in the export.</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface },
  row: { minHeight: 86, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  creditAvatar: { backgroundColor: colors.paleGreen }, debitAvatar: { backgroundColor: colors.dangerPale }, initials: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  main: { flex: 1, gap: 5 }, title: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  amount: { color: colors.ink, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 0 },
  credit: { color: colors.primary }, debit: { color: colors.danger }, chevron: { color: colors.primary, fontSize: 23 }, pressed: { opacity: 0.65 },
  details: { backgroundColor: colors.paper, borderRadius: 8, padding: 12, gap: 5, marginBottom: 12 },
  detailText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
});
