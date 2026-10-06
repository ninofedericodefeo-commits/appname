import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createSampleBankTransactions, detectRecurringCharges, isRecurringChargeTracked, parseBankCsv, type BankTransaction } from '@/features/bankHistory/logic';
import { useBankHistoryStore } from '@/stores/bankHistoryStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { colors } from '@/theme';

const money = (cents: number) => `${cents < 0 ? '−' : '+'}$${(Math.abs(cents) / 100).toFixed(2)}`;
const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function BankHistoryPanel() {
  const {
    transactions,
    lastImportedAt,
    isSampleData,
    dismissedRecurringKeys,
    importTransactions,
    loadSampleTransactions,
    dismissRecurringCharge,
    restoreRecurringCharge,
    clearHistory,
  } = useBankHistoryStore();
  const { subscriptions, saveSubscription } = useSubscriptionStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [preview, setPreview] = useState<{
    fileName: string;
    transactions: BankTransaction[];
    skippedRows: number;
  } | null>(null);
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(20);
  const candidates = useMemo(() => detectRecurringCharges(transactions), [transactions]);
  const activeCandidates = candidates.filter((candidate) => !dismissedRecurringKeys.includes(candidate.key));
  const dismissedCandidates = candidates.filter((candidate) => dismissedRecurringKeys.includes(candidate.key));
  const sortedTransactions = useMemo(
    () => [...transactions].sort((left, right) => right.date.localeCompare(left.date)),
    [transactions],
  );

  async function importCsv() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      });
      if (result.canceled) return;

      setPreview(null);
      const asset = result.assets[0];
      if (asset.size !== undefined && asset.size > 5_000_000) {
        throw new Error('Choose a CSV file smaller than 5 MB.');
      }
      const content = asset.file
        ? await asset.file.text()
        : await new ExpoFile(asset.uri).text();
      const parsed = parseBankCsv(content);
      setPreview({ fileName: asset.name, ...parsed });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import this file. Choose a CSV exported by your bank and try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (!preview) return;
    const added = importTransactions(preview.transactions);
    setPreview(null);
    setMessage(`${added} new transaction${added === 1 ? '' : 's'} imported${preview.skippedRows ? `; ${preview.skippedRows} invalid row${preview.skippedRows === 1 ? '' : 's'} skipped` : ''}. Transactions already saved are ignored.`);
  }

  function loadSampleData() {
    setError('');
    const added = loadSampleTransactions(createSampleBankTransactions());
    setMessage(added > 0
      ? `${added} fictional sample transactions added. They are labeled as sample data and stored only on this device.`
      : 'Clear the current history before loading sample transactions.');
  }

  function addSuggestion(candidate: (typeof candidates)[number]) {
    saveSubscription({
      name: candidate.merchant.slice(0, 80),
      amountCents: candidate.amountCents,
      cadence: candidate.cadence,
      day: candidate.day,
      month: candidate.month,
    });
    setMessage(`${candidate.merchant} added to subscriptions. Check its details before relying on reminders.`);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bank history</Text>
      <Text style={styles.description}>
        Import a CSV statement exported from your bank. The file is processed and saved only on this device; it is not sent to GasFinder. Charges need negative amounts or separate debit and credit columns for recurring detection. Bank sign-in and automatic bank syncing are not connected.
      </Text>
      <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void importCsv()}>
        <Text style={styles.buttonText}>{busy ? 'Reading CSV…' : preview ? 'Choose a different CSV' : transactions.length ? 'Import more bank history' : 'Import bank history CSV'}</Text>
      </Pressable>
      {transactions.length === 0 && !preview && (
        <>
          <Pressable accessibilityRole="button" style={styles.sampleButton} onPress={loadSampleData}>
            <Text style={styles.sampleButtonText}>Load sample bank history</Text>
          </Pressable>
          <Text style={styles.caption}>Fictional test transactions only. No FinanceKit or bank connection.</Text>
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.feedback}>{message}</Text> : null}

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.section}>Review before importing</Text>
          <Text style={styles.caption}>{preview.fileName} · {preview.transactions.length} valid transactions</Text>
          {preview.skippedRows > 0 && (
            <Text style={styles.error}>{preview.skippedRows} invalid row{preview.skippedRows === 1 ? '' : 's'} will be skipped.</Text>
          )}
          <Text style={styles.caption}>Nothing is saved until you confirm. Transactions already in your history are ignored.</Text>
          <Text style={styles.caption}>First {Math.min(preview.transactions.length, 5)} transactions:</Text>
          {preview.transactions.slice(0, 5).map((transaction) => (
            <View key={transaction.id} style={styles.transaction}>
              <View style={styles.suggestionDetails}>
                <Text style={styles.merchant}>{transaction.description}</Text>
                <Text style={styles.caption}>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.amount, transaction.amountCents < 0 && styles.expense]}>{money(transaction.amountCents)}</Text>
            </View>
          ))}
          {preview.transactions.length > 5 && (
            <Text style={styles.caption}>And {preview.transactions.length - 5} more. Review the file in your bank’s CSV export if you need to check individual rows.</Text>
          )}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.confirmButton} onPress={confirmImport}>
              <Text style={styles.confirmText}>Import {preview.transactions.length} transactions</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setPreview(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {transactions.length > 0 && (
        <>
          {isSampleData && <Text style={styles.sampleBadge}>SAMPLE DATA · NOT REAL BANK TRANSACTIONS</Text>}
          {lastImportedAt && <Text style={styles.caption}>{isSampleData ? 'Sample data loaded' : 'Last imported'} {new Date(lastImportedAt).toLocaleString()} · {transactions.length} transactions saved</Text>}
          <Text style={styles.section}>Possible recurring charges</Text>
          <Text style={styles.caption}>These are pattern matches, not confirmed subscriptions. An early signal has 2 matching charges; a repeated pattern has 3 or more.</Text>
          {activeCandidates.length === 0 ? (
            <Text style={styles.caption}>{dismissedCandidates.length ? 'All detected suggestions are dismissed. Restore one below or import more history.' : 'No recurring charges found yet. Two or more similar charges about a month or year apart are needed.'}</Text>
          ) : activeCandidates.map((candidate) => {
            const alreadyTracked = subscriptions.some((subscription) =>
              subscription.active && isRecurringChargeTracked(candidate.merchant, [subscription.name]),
            );
            const amountRange = candidate.minAmountCents === candidate.maxAmountCents
              ? currency(candidate.minAmountCents)
              : `${currency(candidate.minAmountCents)} - ${currency(candidate.maxAmountCents)}`;
            return (
              <View key={candidate.key} style={styles.suggestion}>
                <View style={styles.suggestionDetails}>
                  <Text style={styles.merchant}>{candidate.merchant}</Text>
                  <Text style={styles.caption}>
                    {candidate.confidence === 'repeated' ? 'Repeated pattern' : 'Early signal'} · {candidate.occurrences} charges · about every {candidate.averageIntervalDays} days · amounts {amountRange}
                  </Text>
                </View>
                <View style={styles.suggestionActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={alreadyTracked}
                    style={[styles.addButton, alreadyTracked && styles.disabled]}
                    onPress={() => addSuggestion(candidate)}
                  >
                    <Text style={styles.addButtonText}>{alreadyTracked ? 'Tracked' : 'Add'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.dismissButton} onPress={() => dismissRecurringCharge(candidate.key)}>
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {dismissedCandidates.length > 0 && (
            <>
              <Pressable accessibilityRole="button" style={styles.moreButton} onPress={() => setShowDismissed((shown) => !shown)}>
                <Text style={styles.moreButtonText}>{showDismissed ? 'Hide' : 'Show'} dismissed suggestions ({dismissedCandidates.length})</Text>
              </Pressable>
              {showDismissed && dismissedCandidates.map((candidate) => (
                <View key={candidate.key} style={styles.suggestion}>
                  <Text style={[styles.merchant, styles.suggestionDetails]}>{candidate.merchant}</Text>
                  <Pressable accessibilityRole="button" style={styles.dismissButton} onPress={() => restoreRecurringCharge(candidate.key)}>
                    <Text style={styles.dismissText}>Restore</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <Text style={styles.section}>Recent transactions</Text>
          {sortedTransactions.slice(0, visibleTransactionCount).map((transaction) => (
            <View key={transaction.id} style={styles.transaction}>
              <View style={styles.suggestionDetails}>
                <Text style={styles.merchant}>{transaction.description}</Text>
                <Text style={styles.caption}>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.amount, transaction.amountCents < 0 && styles.expense]}>{money(transaction.amountCents)}</Text>
            </View>
          ))}
          {transactions.length > visibleTransactionCount && (
            <Pressable accessibilityRole="button" style={styles.moreButton} onPress={() => setVisibleTransactionCount((count) => count + 20)}>
              <Text style={styles.moreButtonText}>Show 20 more transactions</Text>
            </Pressable>
          )}

          {confirmClear ? (
            <View style={styles.confirm}>
              <Text style={styles.caption}>Delete all imported bank history from this device?</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.clearButton} onPress={() => { clearHistory(); setConfirmClear(false); setMessage('Imported bank history cleared from this device.'); }}>
                  <Text style={styles.clearText}>Delete history</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => setConfirmClear(false)}>
                  <Text style={styles.cancelText}>Keep history</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" style={styles.clearLink} onPress={() => setConfirmClear(true)}>
              <Text style={styles.clearText}>Clear imported bank history</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 18, gap: 10 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 46, paddingHorizontal: 14, borderRadius: 7, backgroundColor: colors.ink },
  buttonText: { color: colors.surface, fontWeight: '800', textAlign: 'center' },
  sampleButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paleGreen },
  sampleButtonText: { color: colors.ink, fontWeight: '800', textAlign: 'center' },
  sampleBadge: { color: colors.accentDark, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  feedback: { color: colors.primary, fontSize: 13, lineHeight: 18 },
  preview: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, gap: 8, backgroundColor: colors.paleGreen },
  section: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 8 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  suggestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  suggestionDetails: { flex: 1, gap: 3 },
  merchant: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  addButton: { minWidth: 60, minHeight: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.paleGreen },
  addButtonText: { color: colors.ink, fontWeight: '800' },
  suggestionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dismissButton: { minHeight: 40, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6 },
  dismissText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  transaction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line },
  amount: { fontVariant: ['tabular-nums'], fontSize: 14, fontWeight: '800', color: colors.primary },
  expense: { color: colors.ink },
  confirm: { padding: 12, backgroundColor: colors.paleOrange, gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  confirmButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.ink, borderRadius: 6 },
  confirmText: { color: colors.surface, fontWeight: '700', fontSize: 13 },
  clearLink: { alignSelf: 'flex-start', paddingVertical: 8 },
  clearButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.dangerPale, borderRadius: 6 },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6 },
  cancelText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  moreButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  moreButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
