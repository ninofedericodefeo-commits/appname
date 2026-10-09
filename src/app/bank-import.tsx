import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { IconButton } from '@/components/IconButton';
import { applyBankImport, guessMapping, MAX_CSV_BYTES, parseBankCSV, previewBankCSV } from '@/features/bank/importLogic';
import type { BankCSV, BankMapping } from '@/features/bank/importLogic';
import { pickBankCSV } from '@/features/bank/pickBankCSV';
import { ruleDescription } from '@/features/goals/logic';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

type Column = Exclude<keyof BankMapping, 'mode' | 'spendingSign' | 'dateOrder'>;
const columnNames: Record<Column, string> = { date: 'Date', description: 'Description', amount: 'Amount', debit: 'Debit / money out', credit: 'Credit / money in', currency: 'Currency', type: 'Transaction type', status: 'Status', transactionId: 'Transaction ID' };

function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
    <Text style={[styles.choiceText, selected && styles.selectedText]}>{label}</Text>
  </Pressable>;
}
function Check({ checked, label, onPress, disabled = false }: { checked: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={styles.checkButton}>
    <View style={[styles.check, checked && styles.selected, disabled && styles.disabled]}><Text style={styles.selectedText}>{checked ? '✓' : ''}</Text></View>
  </Pressable>;
}

export default function BankImportScreen() {
  const pocket = usePocketStore();
  const hydrated = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [csv, setCSV] = useState<BankCSV | null>(null);
  const [mapping, setMapping] = useState<BankMapping | null>(null);
  const [name, setName] = useState('');
  const [accountDraft, setAccountDraft] = useState<string | null>(null);
  const account = accountDraft ?? pocket.bankImportAccountLabel;
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [column, setColumn] = useState<Column | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [selectionOverrides, setSelectionOverrides] = useState<Map<string, boolean>>(new Map());
  const [limit, setLimit] = useState(20);
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludedLimit, setExcludedLimit] = useState(20);
  const [applyRule, setApplyRule] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number; savedCents: number } | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const review = useMemo(() => {
    if (!csv || !mapping) return { rows: [], excluded: [], error: '' };
    try { return { ...previewBankCSV(csv, mapping, account, pocket.purchases, pocket.bankImportKeys), error: '' }; }
    catch (cause) { return { rows: [], excluded: [], error: cause instanceof Error ? cause.message : 'Check the selected columns.' }; }
  }, [csv, mapping, account, pocket.purchases, pocket.bankImportKeys]);
  const selectedIds = useMemo(() => new Set(review.rows.filter((row) => row.duplicate !== 'known' &&
    (selectionOverrides.get(row.id) ?? !row.duplicate)).map((row) => row.id)), [review.rows, selectionOverrides]);
  const selected = useMemo(() => review.rows.filter((row) => row.duplicate !== 'known' && selectedIds.has(row.id)), [review.rows, selectedIds]);
  const plan = useMemo(() => applyBankImport(pocket, selected, applyRule && !!pocket.activeGoal), [pocket, selected, applyRule]);
  const total = selected.reduce((sum, row) => sum + row.amountCents, 0);

  function load(text: string, filename: string) {
    const parsed = parseBankCSV(text);
    setCSV(parsed); setMapping(guessMapping(parsed)); setName(filename); setPaste(''); setShowPaste(false);
    setLimit(20); setShowExcluded(false); setExcludedLimit(20); setDone(null); setError(''); setApplyRule(false);
    setSelectionOverrides(new Map());
    Keyboard.dismiss();
  }
  async function chooseFile() {
    const current = ++request.current;
    setBusy(true); setError('');
    try {
      const file = await pickBankCSV();
      if (current === request.current && file) load(file.text, file.name);
    } catch (cause) {
      if (current !== request.current) return;
      const message = cause instanceof Error ? cause.message : '';
      setError(/native module|ExpoDocumentPicker|Cannot find native/i.test(message)
        ? 'File picking needs a rebuilt app. You can paste the CSV below to import now.'
        : message || 'Could not open this file. Choose a CSV from Files or paste it below.');
      setShowPaste(true);
    } finally { if (current === request.current) setBusy(false); }
  }
  function toggle(id: string) { setSelectionOverrides((previous) => new Map(previous).set(id, !selectedIds.has(id))); }
  function importSelected() {
    if (!hydrated || review.error || !selected.length || busy) return;
    const result = pocket.importBankPurchases(selected, applyRule && !!pocket.activeGoal, account);
    setDone(result); setCSV(null); setMapping(null); setPaste(''); setSelectionOverrides(new Map()); setError('');
  }
  function columnField(field: Column) {
    return <Pressable key={field} accessibilityRole="button" accessibilityLabel={`Choose ${columnNames[field]} column`}
      onPress={() => setColumn(field)} style={styles.field}>
      <Text style={styles.label}>{columnNames[field]}</Text><Text style={styles.fieldValue}>{mapping && mapping[field] >= 0 ? csv?.headers[mapping[field]] : 'Not selected'} ▾</Text>
    </Pressable>;
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>PURCHASE HISTORY</Text>
      <Text style={styles.title}>Import bank log</Text>
      <Text style={styles.body}>Export transactions as CSV from your bank, then review them here. The file is read on your device.</Text>
      {done ? <View style={styles.card}>
        <Text style={styles.section}>{done.imported.toLocaleString()} purchase{done.imported === 1 ? '' : 's'} imported</Text>
        <Text style={styles.body}>{formatMoney(done.savedCents)} added to the pocket estimate.</Text>
        {done.skipped > 0 && <Text style={styles.hint}>{done.skipped.toLocaleString()} duplicate or invalid rows weren’t added.</Text>}
        <Button label="Back to Savings & Activity" onPress={() => router.navigate('/investment')} />
        <Button label="Choose another CSV" secondary onPress={() => { setDone(null); void chooseFile(); }} />
      </View> : <>
        {!csv && <View style={styles.card}>
          <Button label={busy ? 'Choosing file…' : 'Choose bank CSV'} onPress={() => void chooseFile()} disabled={busy || !hydrated} />
          {busy && <Button label="Cancel file selection" secondary onPress={() => { request.current++; setBusy(false); }} />}
          <Button label={showPaste ? 'Hide pasted CSV' : 'Or paste CSV'} secondary onPress={() => setShowPaste(!showPaste)} />
          {showPaste && <><TextInput multiline value={paste} onChangeText={setPaste} maxLength={MAX_CSV_BYTES} style={[styles.input, styles.csvInput]}
            autoCorrect={false} autoCapitalize="none" accessibilityLabel="Bank CSV contents" placeholder={'Date,Description,Amount\n10/08/2026,Coffee,-4.50'} />
            <Button label="Review pasted CSV" disabled={!paste.trim() || busy || !hydrated} onPress={() => { try { load(paste, 'Pasted CSV'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this CSV.'); } }} /></>}
          <Text style={styles.hint}>UTF-8 CSV, TSV or text exports · up to 2 MB / 5,000 rows. PDF and Excel statements need to be exported as CSV first.</Text>
        </View>}
        {csv && mapping && <>
          <View style={styles.card}>
            <View style={styles.rowBetween}><Text style={styles.section}>Check columns</Text><Button label="Change file" secondary onPress={() => { setCSV(null); setMapping(null); setError(''); }} /></View>
            <Text style={styles.hint}>{name} · {csv.rows.length.toLocaleString()} rows</Text>
            <Text style={styles.label}>Account nickname</Text>
            <TextInput value={account} onChangeText={setAccountDraft} maxLength={60} style={styles.input} accessibilityLabel="Bank account nickname" placeholder="Main checking" />
            <Text style={styles.hint}>Use this same nickname next time to prevent repeat imports.</Text>
            {columnField('date')}{columnField('description')}
            <View style={styles.row}><Choice label="One amount column" selected={mapping.mode === 'signed'} onPress={() => setMapping({ ...mapping, mode: 'signed' })} /><Choice label="Debit / credit columns" selected={mapping.mode === 'debit-credit'} onPress={() => setMapping({ ...mapping, mode: 'debit-credit' })} /></View>
            {mapping.mode === 'signed' ? <>{columnField('amount')}<Text style={styles.label}>Money spent is</Text><View style={styles.row}>
              <Choice label="Negative (−)" selected={mapping.spendingSign === 'negative'} onPress={() => setMapping({ ...mapping, spendingSign: 'negative' })} />
              <Choice label="Positive (+)" selected={mapping.spendingSign === 'positive'} onPress={() => setMapping({ ...mapping, spendingSign: 'positive' })} />
            </View></> : <>{columnField('debit')}{columnField('credit')}</>}
            <Text style={styles.label}>Date order</Text><View style={styles.row}>
              <Choice label="Month / day" selected={mapping.dateOrder === 'mdy'} onPress={() => setMapping({ ...mapping, dateOrder: 'mdy' })} />
              <Choice label="Day / month" selected={mapping.dateOrder === 'dmy'} onPress={() => setMapping({ ...mapping, dateOrder: 'dmy' })} />
            </View>
            <Button label={advanced ? 'Hide extra columns' : 'More columns'} secondary onPress={() => setAdvanced(!advanced)} />
            {advanced && <>{columnField('currency')}{columnField('type')}{columnField('status')}{columnField('transactionId')}</>}
            <Text style={styles.hint}>USD only. Check the spending direction and exclude transfers or card payments before importing.</Text>
          </View>
          {review.error ? <Text accessibilityRole="alert" style={styles.error}>{review.error}</Text> : <View style={styles.card}>
            <Text style={styles.section}>Review purchases</Text>
            <Text style={styles.hint}>Possible matches to existing purchases start unchecked. Already imported rows can’t be added again.</Text>
            <View style={styles.row}><Button label="Select new rows" secondary onPress={() => setSelectionOverrides(new Map(review.rows.map((row) => [row.id, !row.duplicate])))} /><Button label="Clear selection" secondary onPress={() => setSelectionOverrides(new Map(review.rows.map((row) => [row.id, false])))} /></View>
            {review.rows.length === 0 && <Text style={styles.body}>No spending rows found. Check the columns and spending direction above.</Text>}
            {review.rows.slice(0, limit).map((row) => <View key={`${row.id}-${row.rowNumber}`} style={styles.transaction}>
              <Check checked={row.duplicate !== 'known' && selectedIds.has(row.id)} disabled={row.duplicate === 'known'} label={`Import ${row.title}, ${formatMoney(row.amountCents)}, row ${row.rowNumber}`} onPress={() => toggle(row.id)} />
              <View style={styles.transactionMain}><View style={styles.rowBetween}><Text style={styles.transactionTitle}>{row.title}</Text><Text style={styles.amount}>{formatMoney(row.amountCents)}</Text></View>
                <Text style={styles.hint}>{new Date(row.purchasedAt).toLocaleDateString()} · row {row.rowNumber}</Text>
                {row.duplicate && <Text style={styles.match}>{row.duplicate === 'known' ? 'Already imported' : `Same date and amount as “${row.matchTitle}”. Include only if this is a different purchase.`}</Text>}
              </View>
            </View>)}
            {limit < review.rows.length && <Button label="Show more rows" secondary onPress={() => setLimit(limit + 30)} />}
            {review.excluded.length > 0 && <><Button label={`${showExcluded ? 'Hide' : 'Show'} ${review.excluded.length.toLocaleString()} skipped row${review.excluded.length === 1 ? '' : 's'}`} secondary onPress={() => setShowExcluded(!showExcluded)} />
              {showExcluded && <>{review.excluded.slice(0, excludedLimit).map((row) => <Text key={row.rowNumber} style={styles.hint}>Row {row.rowNumber}: {row.reason}</Text>)}
                {excludedLimit < review.excluded.length && <Button label="Show more skipped rows" secondary onPress={() => setExcludedLimit(excludedLimit + 30)} />}</>}
            </>}
          </View>}
          <View style={styles.card}>
            <Text style={styles.section}>{selected.length.toLocaleString()} selected · {formatMoney(total)}</Text>
            {pocket.activeGoal ? <View style={styles.ruleRow}>
              <Check checked={applyRule} label="Apply current goal rule to imported purchases" onPress={() => setApplyRule(!applyRule)} />
              <View style={styles.transactionMain}><Text style={styles.transactionTitle}>Apply my goal’s rule</Text><Text style={styles.hint}>{ruleDescription(pocket.activeGoal.setAsideRule)}</Text></View>
            </View> : <Text style={styles.hint}>Create a goal later to use this spending history for savings suggestions.</Text>}
            <Text style={styles.body}>{formatMoney(plan.savedCents)} will be added to the pocket estimate{applyRule ? ', capped by your goal and entered balance' : ''}.</Text>
            <Text style={styles.hint}>Account balances aren’t changed by this import. Money stays in your account.</Text>
            <Button label={`Import ${selected.length.toLocaleString()} purchase${selected.length === 1 ? '' : 's'}`} disabled={!selected.length || !!review.error || !hydrated || busy} onPress={importSelected} />
          </View>
        </>}
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </FormScrollView>
    <Modal visible={column !== null} transparent animationType="fade" onRequestClose={() => setColumn(null)}>
      <View style={styles.scrim}><SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}><Text style={styles.section}>Choose {column ? columnNames[column].toLowerCase() : 'column'}</Text><IconButton icon="close" label="Close column selection" onPress={() => setColumn(null)} /></View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {['Not selected', ...(csv?.headers ?? [])].map((header, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${header}${index ? `, column ${index}` : ''}`} style={styles.option}
            onPress={() => { if (column && mapping) setMapping({ ...mapping, [column]: index - 1 }); setColumn(null); }}>
            <Text style={styles.fieldValue}>{header}{index ? ` · ${index}` : ''}</Text>
          </Pressable>)}
        </ScrollView>
      </SafeAreaView></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 36, gap: 16 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800', flexShrink: 1 }, body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, label: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 15, gap: 12 },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ink, padding: 12, borderRadius: 7 },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 13, textAlign: 'center' }, secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, secondaryText: { color: colors.ink }, disabled: { opacity: 0.45 },
  input: { minHeight: 46, padding: 12, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, fontSize: 15, color: colors.ink, backgroundColor: colors.surface }, csvInput: { minHeight: 150, textAlignVertical: 'top' },
  field: { minHeight: 52, borderColor: colors.line, borderWidth: 1, borderRadius: 7, padding: 10, gap: 4 }, fieldValue: { color: colors.ink, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, padding: 10 }, selected: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceText: { color: colors.ink, fontSize: 12, fontWeight: '700' }, selectedText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  transaction: { flexDirection: 'row', gap: 6, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12 }, transactionMain: { flex: 1, gap: 4 }, transactionTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' }, amount: { color: colors.ink, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }, match: { color: colors.accentDark, fontSize: 12, lineHeight: 18 },
  checkButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, check: { width: 24, height: 24, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }, ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 }, scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 }, modal: { maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 12, padding: 15 }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }, option: { minHeight: 48, padding: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
});
