import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateContribution } from '@/features/investing/calculations';
import { useInvestmentStore } from '@/stores/investmentStore';
import type {
  ContributionOption,
  InvestmentDestination,
  PaymentMethod,
  ReviewIntervalDays,
  RoundingIncrement,
} from '@/types/investing';

const paymentMethods: PaymentMethod[] = ['phone', 'debit', 'credit'];
const reviewIntervals: { days: ReviewIntervalDays; label: string }[] = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
];
const contributionOptions: { value: Exclude<ContributionOption, 'none' | 'round-dollar' | 'round-ten'>; label: string }[] = [
  { value: 'fee', label: 'Configured fee' },
  { value: 'round-up', label: 'Round up' },
  { value: 'fixed', label: 'Specific amount' },
];
const roundingIncrements: RoundingIncrement[] = [1, 10, 100];

function InvestmentSettingsPanel({
  feePercent,
  maxExtraPayment,
  reviewIntervalDays,
  destination,
  demoAccountConnected,
  onSave,
  onConnectDemoAccount,
  onDestinationChange,
}: {
  feePercent: number;
  maxExtraPayment: number;
  reviewIntervalDays: ReviewIntervalDays;
  destination: InvestmentDestination;
  demoAccountConnected: boolean;
  onSave: (settings: { feePercent: number; maxExtraPayment: number; reviewIntervalDays: ReviewIntervalDays }) => void;
  onConnectDemoAccount: () => void;
  onDestinationChange: (destination: InvestmentDestination) => void;
}) {
  const [feeInput, setFeeInput] = useState(String(feePercent));
  const [maxExtraInput, setMaxExtraInput] = useState(String(maxExtraPayment));
  const [selectedInterval, setSelectedInterval] = useState(reviewIntervalDays);
  const [error, setError] = useState('');

  function save() {
    const nextFeePercent = Number(feeInput);
    const nextMaxExtraPayment = Number(maxExtraInput);
    if (!feeInput.trim() || !Number.isFinite(nextFeePercent) || nextFeePercent < 0 || nextFeePercent > 100) {
      setError('Fee percent must be between 0 and 100.');
      return;
    }
    if (!maxExtraInput.trim() || !Number.isFinite(nextMaxExtraPayment) || nextMaxExtraPayment < 0 || nextMaxExtraPayment > 1000) {
      setError('Maximum extra payment must be between $0 and $1,000.');
      return;
    }

    onSave({
      feePercent: nextFeePercent,
      maxExtraPayment: Math.round(nextMaxExtraPayment * 100) / 100,
      reviewIntervalDays: selectedInterval,
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Investment settings</Text>
      <Text style={styles.label}>Transaction account</Text>
      <Text style={styles.muted}>{demoAccountConnected ? 'Demo checking account connected' : 'No account connected'}</Text>
      {!demoAccountConnected && (
        <Button label="Connect demo account" secondary onPress={onConnectDemoAccount} />
      )}
      <Text style={styles.label}>Contribution destination</Text>
      <View style={styles.row}>
        {([
          { value: 'cash', label: 'Hold as cash' },
          { value: 'stocks', label: 'Invest in stocks' },
        ] as const).map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={destination === option.value}
            onPress={() => onDestinationChange(option.value)}
          />
        ))}
      </View>
      <Text style={styles.label}>Fee percent</Text>
      <TextInput
        value={feeInput}
        onChangeText={setFeeInput}
        keyboardType="decimal-pad"
        accessibilityLabel="Fee percent"
        style={styles.input}
      />
      <Text style={styles.label}>Maximum extra per transaction ($)</Text>
      <TextInput
        value={maxExtraInput}
        onChangeText={setMaxExtraInput}
        keyboardType="decimal-pad"
        accessibilityLabel="Maximum extra payment"
        style={styles.input}
      />
      <Text style={styles.label}>Investment review interval</Text>
      <View style={styles.row}>
        {reviewIntervals.map((interval) => (
          <Choice
            key={interval.days}
            label={interval.label}
            selected={selectedInterval === interval.days}
            onPress={() => setSelectedInterval(interval.days)}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save settings" onPress={save} />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

export default function InvestmentScreen() {
  const {
    feePercent,
    maxExtraPayment,
    reviewIntervalDays,
    destination,
    demoAccountConnected,
    lastReviewAt,
    investedBalance,
    cashBalance,
    withdrawnTotal,
    payments,
    withdrawals,
    setInvestmentSettings,
    connectDemoAccount,
    setDestination,
    applyDetectedTransaction,
    withdrawBalance,
  } = useInvestmentStore();
  const [showSettings, setShowSettings] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('phone');
  const [paymentError, setPaymentError] = useState('');
  const [pendingTransaction, setPendingTransaction] = useState<{ amount: number; method: PaymentMethod } | null>(null);
  const [contributionOption, setContributionOption] = useState<ContributionOption | null>(null);
  const [fixedAmount, setFixedAmount] = useState('');
  const [roundingIncrement, setRoundingIncrement] = useState<RoundingIncrement>(1);
  const [sellConfirmationStep, setSellConfirmationStep] = useState<0 | 1 | 2>(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const activeBalance = destination === 'cash' ? cashBalance : investedBalance;
  const totalContributions = payments.reduce((total, payment) => total + payment.surcharge, 0);
  const totalCurrentBalance = cashBalance + investedBalance;
  const reviewDate = new Date(lastReviewAt + reviewIntervalDays * 24 * 60 * 60 * 1000);
  const reviewDue = now !== null && now >= reviewDate.getTime();
  const contributionAmount = calculateContribution({
    amount: pendingTransaction?.amount ?? 0,
    option: contributionOption,
    fixedAmount,
    feePercent,
    maxExtraPayment,
    roundingIncrement,
  });

  function simulatePaymentDetection() {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a payment amount greater than $0.');
      return;
    }
    if (!demoAccountConnected) {
      setPaymentError('Connect the demo account in settings first.');
      return;
    }

    setPendingTransaction({ amount, method });
    setContributionOption(null);
    setFixedAmount('');
    setRoundingIncrement(1);
    setAmountInput('');
    setPaymentError('');
  }

  function recordContribution(option: ContributionOption, amount: number) {
    if (!pendingTransaction) return;
    applyDetectedTransaction(pendingTransaction.amount, pendingTransaction.method, amount, option, roundingIncrement);
    setPendingTransaction(null);
    setContributionOption(null);
    setFixedAmount('');
  }

  function finishSale() {
    withdrawBalance();
    setSellConfirmationStep(0);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Investing</Text>
          <Link href="/" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Gas prices</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.eyebrow}>LOCAL DEMO</Text>
              <Text style={styles.cardTitle}>{destination === 'cash' ? 'Cash savings' : 'Stock investing'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Investment settings"
              style={styles.gearButton}
              onPress={() => setShowSettings((visible) => !visible)}
            >
              <Text style={styles.gearText}>⚙️</Text>
            </Pressable>
          </View>
          <Text style={styles.description}>
            Demo only. No bank account is connected and this does not move money or buy or sell stocks.
          </Text>
          <Text style={styles.balanceLabel}>{destination === 'cash' ? 'Cash balance (simulated)' : 'Stock balance (simulated)'}</Text>
          <Text style={styles.balance}>${activeBalance.toFixed(2)}</Text>
          <View style={styles.reviewBubble}>
            <Text style={styles.reviewText}>
              {reviewDue ? 'Next review is due now' : `Next review on ${reviewDate.toLocaleDateString()}`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={activeBalance <= 0}
            style={styles.sellNow}
            onPress={() => setSellConfirmationStep(1)}
          >
            <Text style={styles.sellNowText}>{destination === 'cash' ? 'Withdraw now' : 'Sell now'}</Text>
          </Pressable>
          <Text style={styles.soldLabel}>Withdrawn in demo: ${withdrawnTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Savings tracker</Text>
          <Text style={styles.description}>
            Demo contributions are not real savings. Contributions are totalled separately from current balances and withdrawals.
          </Text>
          <View style={styles.trackerRow}>
            <View style={styles.trackerMetric}>
              <Text style={styles.balanceLabel}>Contributed</Text>
              <Text style={styles.trackerAmount}>${totalContributions.toFixed(2)}</Text>
            </View>
            <View style={styles.trackerMetric}>
              <Text style={styles.balanceLabel}>Current balances</Text>
              <Text style={styles.trackerAmount}>${totalCurrentBalance.toFixed(2)}</Text>
            </View>
            <View style={styles.trackerMetric}>
              <Text style={styles.balanceLabel}>Withdrawn</Text>
              <Text style={styles.trackerAmount}>${withdrawnTotal.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Link href="/activity" asChild>
              <Pressable style={styles.secondaryNavButton} accessibilityRole="button">
                <Text style={styles.secondaryNavText}>View full ledger</Text>
              </Pressable>
            </Link>
            <Link href="/spending" asChild>
              <Pressable style={styles.secondaryNavButton} accessibilityRole="button">
                <Text style={styles.secondaryNavText}>Spending pause</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {showSettings && (
          <InvestmentSettingsPanel
            key={`${feePercent}-${maxExtraPayment}-${reviewIntervalDays}`}
            feePercent={feePercent}
            maxExtraPayment={maxExtraPayment}
            reviewIntervalDays={reviewIntervalDays}
            destination={destination}
            demoAccountConnected={demoAccountConnected}
            onConnectDemoAccount={connectDemoAccount}
            onDestinationChange={setDestination}
            onSave={(settings) => {
              setInvestmentSettings(settings);
              setShowSettings(false);
            }}
          />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transaction contributions</Text>
          <Text style={styles.description}>
            A real bank connection can report transactions after they post. This demo lets you simulate that event and choose whether to contribute.
          </Text>
          {pendingTransaction ? (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>Payment detected</Text>
              <Text style={styles.description}>
                {pendingTransaction.method} payment of ${pendingTransaction.amount.toFixed(2)}. Add an optional contribution?
              </Text>
              <View style={styles.row}>
                {contributionOptions.map((option) => (
                  <Choice
                    key={option.value}
                    label={option.label}
                    selected={contributionOption === option.value}
                    onPress={() => setContributionOption(option.value)}
                  />
                ))}
              </View>
              {contributionOption === 'round-up' && (
                <>
                  <Text style={styles.label}>Round up to the nearest</Text>
                  <View style={styles.row}>
                    {roundingIncrements.map((increment) => (
                      <Choice
                        key={increment}
                        label={`$${increment}`}
                        selected={roundingIncrement === increment}
                        onPress={() => setRoundingIncrement(increment)}
                      />
                    ))}
                  </View>
                </>
              )}
              {contributionOption === 'fixed' && (
                <TextInput
                  value={fixedAmount}
                  onChangeText={setFixedAmount}
                  placeholder="Amount to add (e.g. 2.00)"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Specific contribution amount"
                  style={styles.input}
                />
              )}
              {contributionOption && (
                <Text style={styles.contributionPreview}>
                  Add ${contributionAmount.toFixed(2)}
                  {contributionAmount >= maxExtraPayment && maxExtraPayment > 0 ? ' (maximum reached)' : ''}
                </Text>
              )}
              <View style={styles.row}>
                <Button label="No extra" secondary onPress={() => recordContribution('none', 0)} />
                <Button
                  label="Confirm extra"
                  disabled={!contributionOption || (contributionOption === 'fixed' && contributionAmount <= 0)}
                  onPress={() => {
                    if (contributionOption) recordContribution(contributionOption, contributionAmount);
                  }}
                />
              </View>
            </View>
          ) : (
            <>
              <TextInput
                value={amountInput}
                onChangeText={setAmountInput}
                placeholder="Detected payment amount (e.g. 45.34)"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <View style={styles.row}>
                {paymentMethods.map((paymentMethod) => (
                  <Choice
                    key={paymentMethod}
                    label={paymentMethod}
                    selected={method === paymentMethod}
                    onPress={() => setMethod(paymentMethod)}
                  />
                ))}
              </View>
              {paymentError ? <Text style={styles.error}>{paymentError}</Text> : null}
              <Button label="Simulate payment detected" onPress={simulatePaymentDetection} />
            </>
          )}
        </View>

        {(payments.length > 0 || withdrawals.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent activity</Text>
            {payments.slice(0, 5).map((payment) => (
              <View key={payment.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyTitle}>{payment.method} payment · ${payment.amount.toFixed(2)}</Text>
                  <Text style={styles.muted}>{new Date(payment.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.historyAmount}>+${payment.surcharge.toFixed(2)}</Text>
              </View>
            ))}
            {withdrawals.slice(0, 3).map((withdrawal) => (
              <View key={withdrawal.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyTitle}>
                    {withdrawal.legacy
                      ? 'Previous demo withdrawals (combined)'
                      : withdrawal.destination === 'cash'
                        ? 'Cash withdrawal'
                        : 'Simulated stock sale'}
                  </Text>
                  <Text style={styles.muted}>
                    {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleDateString() : 'Earlier demo total'}
                  </Text>
                </View>
                <Text style={styles.withdrawalAmount}>-${withdrawal.amount.toFixed(2)}</Text>
              </View>
            ))}
            <Link href="/activity" asChild>
              <Pressable style={styles.secondaryNavButton} accessibilityRole="button">
                <Text style={styles.secondaryNavText}>Open full ledger</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={sellConfirmationStep > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setSellConfirmationStep(0)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.cardTitle}>{sellConfirmationStep === 1 ? 'Review withdrawal' : 'Confirm one last time'}</Text>
            <Text style={styles.description}>
              {sellConfirmationStep === 1
                ? `You are about to ${destination === 'cash' ? 'withdraw' : 'sell'} the current demo balance of $${activeBalance.toFixed(2)}. Continue?`
                : `Confirm ${destination === 'cash' ? 'withdrawal' : 'sale'} of $${activeBalance.toFixed(2)} from this local demo balance.`}
            </Text>
            {sellConfirmationStep === 1 ? (
              <Button label="Continue" onPress={() => setSellConfirmationStep(2)} />
            ) : (
              <Button label={`Confirm ${destination === 'cash' ? 'withdrawal' : 'sale'}`} onPress={finishSale} />
            )}
            <Button label="Cancel" secondary onPress={() => setSellConfirmationStep(0)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: '#111827', fontSize: 30, fontWeight: '800' },
  navButton: { backgroundColor: '#111827', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e7ebf0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#047857', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: '#111827', fontSize: 19, fontWeight: '800' },
  gearButton: { padding: 6 },
  gearText: { fontSize: 22 },
  description: { color: '#5f6470', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 12 },
  balanceLabel: { color: '#6b7280', fontSize: 13, marginTop: 16 },
  balance: { color: '#064e3b', fontSize: 36, fontWeight: '800', marginTop: 2 },
  reviewBubble: { alignSelf: 'flex-start', backgroundColor: '#eef4ff', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginTop: 14 },
  reviewText: { color: '#1e40af', fontSize: 13, fontWeight: '700' },
  sellNow: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12 },
  sellNowText: { color: '#4f46e5', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  soldLabel: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  trackerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  trackerMetric: { flexGrow: 1, minWidth: 90 },
  trackerAmount: { color: '#111827', fontSize: 18, fontWeight: '800', marginTop: 3 },
  secondaryNavButton: { flexGrow: 1, borderRadius: 10, backgroundColor: '#eef2ff', paddingVertical: 11, paddingHorizontal: 12, alignItems: 'center' },
  secondaryNavText: { color: '#3730a3', fontSize: 13, fontWeight: '700' },
  label: { color: '#4b5563', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  muted: { color: '#6b7280', fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginVertical: 7 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#d5dbe4', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  choiceSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { color: '#374151', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  choiceTextSelected: { color: '#ffffff' },
  input: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#d5dbe4', paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 8 },
  button: { backgroundColor: '#4f8cff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, flexGrow: 1 },
  buttonSecondary: { backgroundColor: '#f3f6fa', borderWidth: 1, borderColor: '#e2e8f0' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  buttonTextSecondary: { color: '#111827' },
  pendingCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  pendingTitle: { color: '#064e3b', fontSize: 16, fontWeight: '700' },
  contributionPreview: { color: '#047857', fontWeight: '700', marginVertical: 8 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#edf0f3' },
  historyTitle: { color: '#111827', fontSize: 13, fontWeight: '600' },
  historyAmount: { color: '#047857', fontSize: 14, fontWeight: '700' },
  withdrawalAmount: { color: '#b45309', fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  confirmationCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 20 },
});
