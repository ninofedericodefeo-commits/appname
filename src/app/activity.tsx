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
  const contributedTotal = payments.reduce((total, payment) => total + payment.surcharge, 0);
  const currentTotal = cashBalance + investedBalance;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Savings tracker</Text>
          <Link href="/investment" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Investing</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Local demo ledger</Text>
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contributions ({payments.length})</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>Confirmed demo contributions will appear here.</Text>
          ) : (
            payments.map((payment) => (
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
          <Text style={styles.sectionTitle}>Withdrawals ({withdrawals.length})</Text>
          {withdrawals.length === 0 ? (
            <Text style={styles.emptyText}>No withdrawals recorded in this demo yet.</Text>
          ) : (
            withdrawals.map((withdrawal) => (
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
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7ebf0', borderRadius: 16, padding: 15 },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  emptyText: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  entry: { borderTopWidth: 1, borderTopColor: '#edf0f3', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  entryMain: { flex: 1 },
  entryTitle: { color: '#111827', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 3 },
  contributionAmount: { color: '#047857', fontSize: 15, fontWeight: '800' },
  withdrawalAmount: { color: '#b45309', fontSize: 15, fontWeight: '800' },
});
