import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState, useSyncExternalStore } from 'react';
import { Text, TextInput, View } from 'react-native';
import { usePocketStore } from '@/stores/pocketStore';
import { useStatementAutomationStore } from '@/stores/statementAutomationStore';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';

export default function AccountSettingsPanel() {
  useThemeRevision();
  const { linkedBankAccount, bankImportAccountLabel, renameBankAccount } = usePocketStore();
  const pocketReady = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const automationReady = useSyncExternalStore(useStatementAutomationStore.persist.onFinishHydration, useStatementAutomationStore.persist.hasHydrated, () => false);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  function save() {
    if (!pocketReady || !automationReady) return;
    try { const name = (draft ?? linkedBankAccount?.nickname ?? bankImportAccountLabel).trim(); renameBankAccount(name);
      const setup = useStatementAutomationStore.getState(); setup.configure(setup.enabled, name); setDraft(null); setMessage('Account name saved. Your history stays connected.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the account name.'); }
  }
  return <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Bank account</Text><Text style={styles.note}>One linked checking or savings account. Its name can change without creating duplicate transactions.</Text>
    <TextInput value={draft ?? linkedBankAccount?.nickname ?? bankImportAccountLabel} onChangeText={setDraft} maxLength={60} accessibilityLabel="Linked bank account name" style={styles.input} />
    <SubscriptionButton label="Save account name" disabled={!pocketReady || !automationReady} onPress={save} />{!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
  </View>;
}
const styles = themedStyles(() => ({ card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, input: { minHeight: 48, color: colors.ink, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.lineStrong } }));
