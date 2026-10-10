import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LogPurchase } from './LogPurchase';
import { colors } from '@/theme';
import { TransactionRow } from './TransactionRow';
import type { PocketTransaction } from './transactions';

export function PocketTransactions({ transactions }: { transactions: PocketTransaction[] }) {
  const pending = transactions.filter((item) => item.status === 'pending').length;
  return <View style={styles.section}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>Transactions</Text>
      <View style={styles.actions}>
        {transactions.length > 0 && <Pressable accessibilityRole="button" style={styles.seeAll} onPress={() => router.push('/account-transactions')}><Text style={styles.link}>See all</Text></Pressable>}
      </View>
    </View>
    <LogPurchase />
    {pending > 0 && <Text style={styles.pending}>{pending} pending · from your last import</Text>}
    <View style={styles.card}>
      {transactions.length === 0 ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Your history starts here</Text>
        <Text style={styles.emptyText}>Import a bank statement or log a purchase to see your transactions.</Text>
      </View> : transactions.slice(0, 7).map((transaction, index) => <View key={transaction.id} style={index > 0 && styles.divider}><TransactionRow transaction={transaction} /></View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 }, actions: { flexDirection: 'row', alignItems: 'center' },
  seeAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, link: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15, overflow: 'hidden' },
  divider: { borderTopColor: colors.line, borderTopWidth: 1 }, pending: { color: colors.accentDark, fontSize: 12, lineHeight: 18 },
  empty: { paddingVertical: 22, gap: 8 }, emptyTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 }, emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
