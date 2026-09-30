import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInvestmentStore } from '@/stores/investmentStore';

function formatContributionRule(option: string, increment?: number) {
  if (option === 'round-up') return `Round up to $${increment ?? 1}`;
  if (option === 'fee') return 'Configured fee';
  if (option === 'fixed') return 'Specific amount';
  if (option === 'none') return 'No extra';
  return 'Contribution';
}

export default function ActivityScreen() {
  const { payments, withdrawals, cashBalance, investedBalance, withdrawnTotal } = useInvestmentStore();
  const [period, setPeriod] = useState<'all' | '30-days'>('all');
  const [openedAt] = useState(() => Date.now());
  const contributedTotal = payments.reduce((total, payment) => total + payment.surcharge, 0);
  const currentTotal = cashBalance + investedBalance;
  const cutoff = openedAt - 30 * 24 * 60 * 60 * 1000;
  const visiblePayments = period === 'all' ? payments : payments.filter((payment) => Date.parse(payment.createdAt) >= cutoff);
  const visibleWithdrawals = period === 'all' ? withdrawals : withdrawals.filter((withdrawal) => withdrawal.createdAt && Date.parse(withdrawal.createdAt) >= cutoff);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Previous demo records</Text>
          <Link href="/activity" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Activity</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Read-only demo archive</Text>
          <Text style={styles.noticeText}>
            These figures are saved on this device and are not real cash or investment values.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <Summary label="Total contributions" amount={contributedTotal} />
          <Summary label="Current demo balances" amount={currentTotal} />
          <Summary label="Withdrawn in demo" amount={withdrawnTotal} />
        </View>
        <Text style={styles.explanation}>
          Contributions are total extra amounts confirmed in the demo. Current balances and withdrawals are shown separately.
        </Text>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Activity dates</Text>
          {(['all', '30-days'] as const).map((value) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }} style={[styles.filterButton, period === value && styles.filterSelected]} onPress={() => setPeriod(value)}>
              <Text style={[styles.filterText, period === value && styles.filterTextSelected]}>{value === 'all' ? 'All' : 'Last 30 days'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contributions ({visiblePayments.length})</Text>
          {visiblePayments.length === 0 ? (
            <Text style={styles.emptyText}>No demo contributions in this period.</Text>
          ) : (
            visiblePayments.map((payment) => (
              <View key={payment.id} style={styles.entry}>
                <View style={styles.entryMain}>
                  <Text style={styles.entryTitle}>{formatContributionRule(payment.contributionOption, payment.roundingIncrement)}</Text>
                  <Text style={styles.entryMeta}>
                    {payment.method} payment · ${payment.amount.toFixed(2)} · {new Date(payment.createdAt).toLocaleString()}
                  </Text>
                  <Text style={styles.entryMeta}>Destination: {payment.destination} · simulated</Text>
                </View>
                <Text style={styles.contributionAmount}>+${payment.surcharge.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Withdrawals ({visibleWithdrawals.length})</Text>
          {visibleWithdrawals.length === 0 ? (
            <Text style={styles.emptyText}>No demo withdrawals in this period.</Text>
          ) : (
            visibleWithdrawals.map((withdrawal) => (
              <View key={withdrawal.id} style={styles.entry}>
                <View style={styles.entryMain}>
                  <Text style={styles.entryTitle}>
                    {withdrawal.legacy
                      ? 'Previous demo withdrawals (combined)'
                      : withdrawal.destination === 'cash'
                        ? 'Cash withdrawal'
                        : 'Simulated sale'}
                  </Text>
                  <Text style={styles.entryMeta}>
                    {withdrawal.legacy
                      ? 'Original withdrawal dates were not recorded in the earlier demo'
                      : `${withdrawal.destination} · ${
                          withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : 'Date not recorded'
                        }`}
                  </Text>
                </View>
                <Text style={styles.withdrawalAmount}>-${withdrawal.amount.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryAmount}>${amount.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#111827', fontSize: 27, fontWeight: '800' },
  navButton: { backgroundColor: '#111827', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  notice: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 14, padding: 14 },
  noticeTitle: { color: '#9a3412', fontWeight: '800', fontSize: 14 },
  noticeText: { color: '#7c2d12', fontSize: 12, lineHeight: 17, marginTop: 4 },
  summaryGrid: { gap: 9 },
  summary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7ebf0', borderRadius: 14, padding: 14 },
  summaryLabel: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  summaryAmount: { color: '#111827', fontSize: 24, fontWeight: '800', marginTop: 3 },
  explanation: { color: '#5f6470', fontSize: 12, lineHeight: 18 },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  filterLabel: { color: '#374151', fontSize: 13, fontWeight: '700', marginRight: 4 },
  filterButton: { borderRadius: 999, borderWidth: 1, borderColor: '#d5dbe4', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#fff' },
  filterSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  filterText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: '#fff' },
  errorText: { color: '#b91c1c', fontSize: 13 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7ebf0', borderRadius: 16, padding: 15 },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  emptyText: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  entry: { borderTopWidth: 1, borderTopColor: '#edf0f3', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  entryMain: { flex: 1 },
  entryTitle: { color: '#111827', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 3 },
  contributionAmount: { color: '#047857', fontSize: 15, fontWeight: '800' },
  withdrawalAmount: { color: '#b45309', fontSize: 15, fontWeight: '800' },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 7, marginTop: 4 },
  removeText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  confirmCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 14, padding: 15 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  confirmButton: { backgroundColor: '#b91c1c', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16 },
  confirmText: { color: '#fff', fontWeight: '700' },
  cancelButton: { backgroundColor: '#fff', borderRadius: 9, borderWidth: 1, borderColor: '#d1d5db', paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: '#111827', fontWeight: '700' },
});
