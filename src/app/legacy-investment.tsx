import { colors } from '@/theme';
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
        <Text style={styles.kicker}>ARCHIVE</Text>
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
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 },
  navButton: { backgroundColor: colors.ink, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6, minHeight: 44, justifyContent: 'center' },
  navButtonText: { color: colors.surface, fontWeight: '700' },
  notice: { backgroundColor: colors.paleOrange, borderLeftColor: colors.accent, borderLeftWidth: 4, padding: 16 },
  noticeTitle: { color: colors.accentDark, fontWeight: '800', fontSize: 14 },
  noticeText: { color: colors.accentDark, fontSize: 12, lineHeight: 17, marginTop: 4 },
  summaryGrid: { gap: 9 },
  summary: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 16 },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  summaryAmount: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 5, fontVariant: ['tabular-nums'] },
  explanation: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  filterLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '700', marginRight: 4 },
  filterButton: { borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  filterSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: colors.surface },
  errorText: { color: colors.danger, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  emptyText: { color: colors.muted, fontSize: 13, marginTop: 8 },
  entry: { borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  entryMain: { flex: 1 },
  entryTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  entryMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  contributionAmount: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  withdrawalAmount: { color: colors.accentDark, fontSize: 15, fontWeight: '800' },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 7, marginTop: 4 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  confirmCard: { backgroundColor: colors.dangerPale, borderColor: colors.accent, borderWidth: 1, borderRadius: 10, padding: 15 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  confirmButton: { backgroundColor: colors.danger, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 16 },
  confirmText: { color: colors.surface, fontWeight: '700' },
  cancelButton: { backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: colors.ink, fontWeight: '700' },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 1 },
});
