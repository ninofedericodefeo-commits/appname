import { useState, useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { installStatementShortcut } from '@/features/bank/installStatementShortcut';
import { STATEMENT_SHORTCUT_NAME, statementShortcutURL } from '@/features/bank/statementAutomation';
import { usePocketStore } from '@/stores/pocketStore';
import { useStatementAutomationStore } from '@/stores/statementAutomationStore';
import { colors } from '@/theme';

function Button({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export default function StatementAutomationScreen() {
  const settings = useStatementAutomationStore();
  const hydrated = useSyncExternalStore(useStatementAutomationStore.persist.onFinishHydration,
    useStatementAutomationStore.persist.hasHydrated, () => false);
  const pocketHydrated = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const defaultAccount = usePocketStore((state) => state.bankImportAccountLabel);
  const [accountDraft, setAccountDraft] = useState<string | null>(null);
  const [enabledDraft, setEnabledDraft] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [help, setHelp] = useState(false);
  const account = accountDraft ?? (settings.accountLabel || defaultAccount);
  const enabled = enabledDraft ?? settings.enabled;
  const isIPhone = Platform.OS === 'ios';

  async function addShortcut() {
    setBusy(true); setError('');
    try { await installStatementShortcut(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the shortcut file.'); }
    finally { setBusy(false); }
  }
  function saveSettings() {
    settings.configure(enabled, account);
    setAccountDraft(null); setEnabledDraft(null); setSaved(true);
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>CITIZENS → GASFINDER</Text>
      <Text accessibilityRole="header" style={styles.title}>Quick statement import</Text>
      <Text style={styles.body}>Open your PDF in Citizens, tap Share, then send it here. GasFinder handles reading, saving and updating your account.</Text>
      <View style={styles.path}><Text style={styles.pathText}>Citizens PDF</Text><Text style={styles.arrow}>›</Text><Text style={styles.pathText}>Share</Text><Text style={styles.arrow}>›</Text><Text style={styles.pathText}>{isIPhone || Platform.OS === 'web' ? 'Import Statement' : 'GasFinder'}</Text></View>
      <View style={styles.card}>
        <Text style={styles.section}>{Platform.OS === 'android' ? '1. Share to GasFinder' : '1. Add the shortcut once'}</Text>
        {Platform.OS === 'android' ? <Text style={styles.body}>In Citizens’ PDF viewer, tap Share and choose GasFinder. You can also share a downloaded PDF from Files.</Text> : <>
          <Text style={styles.body}>The shortcut sends the shared PDF straight to GasFinder. In the sheet that opens, choose Shortcuts → Add Shortcut.</Text>
          <Button label={busy ? 'Opening…' : 'Add Import Statement shortcut'} onPress={() => void addShortcut()} disabled={!isIPhone || busy} />
          {!isIPhone && <Text style={styles.hint}>Add this shortcut from GasFinder on your iPhone. You can configure automatic import below.</Text>}
          <Text style={styles.hint}>Keep the name “{STATEMENT_SHORTCUT_NAME}”. Returning here does not confirm it was added.</Text>
        </>}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>2. Choose how PDFs are saved</Text>
        {!hydrated || !pocketHydrated ? <Text style={styles.hint}>Loading your settings…</Text> : <>
          <Text style={styles.label}>Account nickname</Text>
          <TextInput accessibilityLabel="Quick import account nickname" value={account} onChangeText={(value) => { setAccountDraft(value); setSaved(false); }}
            maxLength={60} autoCorrect={false} style={styles.input} placeholder="Main checking" />
          <Text style={styles.hint}>Use the same nickname as your previous imports. Changing it starts a separate transaction history.</Text>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Automatically import PDFs I share" accessibilityState={{ checked: enabled }} aria-checked={enabled}
            onPress={() => { setEnabledDraft(!enabled); setSaved(false); }} style={styles.checkRow}>
            <View style={[styles.check, enabled && styles.checked]}><Text style={styles.checkText}>{enabled ? '✓' : ''}</Text></View>
            <Text style={styles.checkLabel}>Automatically import PDFs I share</Text>
          </Pressable>
          <Text style={styles.body}>Updates the closing balance, saves the PDF in Imports and adds spending to Transactions and subscription suggestions.</Text>
          <Text style={styles.hint}>Review the first PDF once to confirm the account. Later matching PDFs save automatically when they read cleanly. Reading warnings, possible duplicate matches and older balances need a review. Your set-aside amount stays as entered.</Text>
          <Button label="Save import preferences" onPress={saveSettings} disabled={!account.trim()} />
          {saved && <Text accessibilityRole="alert" style={styles.saved}>{settings.enabled ? 'Automatic import enabled for shared PDFs.' : 'Shared PDFs will open for review.'}</Text>}
          {settings.enabled && <Text style={styles.hint}>{settings.confirmedAccountIdentifier ? `Account confirmed for ${settings.accountLabel}.` : 'Waiting for your first confirmed statement.'}</Text>}
        </>}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>3. Send your next statement</Text>
        <Text style={styles.body}>Open the checking or savings statement in Citizens. Tap Share, then {Platform.OS === 'android' ? 'GasFinder' : `“${STATEMENT_SHORTCUT_NAME}” in the list of actions`}. Allow the file handoff if iOS asks the first time.</Text>
        <Text style={styles.hint}>No need to save to Files or pick the PDF again. If your viewer offers only Download, open that PDF and share from there.</Text>
        {settings.lastImport && <View style={styles.receipt}>
          <Text style={styles.label}>{settings.lastImport.automatic ? 'Last automatic import' : 'Last confirmed statement'}</Text>
          <Text style={styles.body}>{settings.lastImport.name}</Text>
          <Text style={styles.hint}>Received {new Date(settings.lastImport.importedAt).toLocaleString()} · balance as of {settings.lastImport.balanceAsOf}</Text>
          <Button label="Open Account" secondary onPress={() => router.navigate('/pocket')} />
        </View>}
        <Button label="Open saved imports" secondary onPress={() => router.push('/bank-imports')} />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: help }} onPress={() => setHelp(!help)} style={styles.helpButton}>
        <Text style={styles.link}>{help ? 'Hide setup help −' : 'Shortcut or file-opening help +'}</Text>
      </Pressable>
      {help && <View style={styles.card}>
        <Text style={styles.section}>GasFinder can’t open the PDF?</Text>
        <Text style={styles.body}>If Shortcuts says GasFinder isn’t installed or can’t open the file, update GasFinder and open it once, then share the PDF again. The app needs PDF opening support for this shortcut to work.</Text>
        <Text style={styles.section}>Keep it near the top</Text>
        <Text style={styles.body}>In the PDF’s Share sheet, scroll to Edit Actions. Add “{STATEMENT_SHORTCUT_NAME}” to Favorites and move it up.</Text>
        <Text style={styles.body}>If it is missing, open the shortcut’s Details in Shortcuts and turn on Show in Share Sheet. Check that it receives PDFs and its Open File action uses GasFinder.</Text>
        <Button label="Open statement shortcut ↗" secondary disabled={!isIPhone || busy} onPress={() => {
          void Linking.openURL(statementShortcutURL).catch(() => setError('Open Apple’s Shortcuts app and find GasFinder Import Statement.'));
        }} />
        <Text style={styles.body}>If Shortcuts isn’t offered while adding the file, choose Save to Files, open “GasFinder Import Statement.shortcut” there, then Add Shortcut.</Text>
        <Text style={styles.hint}>Use the installed GasFinder build with PDF opening support. Expo Go cannot receive PDFs for GasFinder; a development build also needs its dev server running.</Text>
        <Text style={styles.hint}>To switch bank accounts, change the nickname above and review the first PDF for that account. To stop automatic saving, uncheck the option and save.</Text>
      </View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>You still sign in and open the statement in Citizens. The shortcut handles the PDF handoff; it cannot download new statements in the background. PDFs are read and saved on this device. The balance is dated to the statement’s closing date.</Text>
    </FormScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 36, gap: 16 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: '800', letterSpacing: -0.7 },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800' }, body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  card: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 12 },
  path: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pathText: { padding: 8, backgroundColor: colors.paleGreen, borderRadius: 6, color: colors.ink, fontSize: 12, fontWeight: '700' }, arrow: { color: colors.muted, fontSize: 20 },
  button: { minHeight: 48, padding: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderRadius: 7 },
  buttonText: { color: colors.surface, fontSize: 13, fontWeight: '800', textAlign: 'center' }, secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, secondaryText: { color: colors.ink }, disabled: { opacity: 0.45 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, color: colors.ink, fontSize: 15 },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48 }, checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink, fontWeight: '700' },
  check: { width: 25, height: 25, borderRadius: 5, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.ink, borderColor: colors.ink }, checkText: { color: colors.surface, fontWeight: '800' },
  saved: { color: colors.primary, fontSize: 13, fontWeight: '700' }, receipt: { padding: 12, borderRadius: 7, backgroundColor: colors.paleGreen, gap: 8 },
  helpButton: { minHeight: 48, justifyContent: 'center' }, link: { color: colors.accentDark, fontSize: 13, fontWeight: '800' }, error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
});
