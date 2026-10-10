import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { IconButton } from '@/components/IconButton';
import { guessMapping, MAX_CSV_BYTES, parseBankCSV, previewAccountTransactions, previewBankCSV } from '@/features/bank/importLogic';
import type { BankCSV, BankMapping } from '@/features/bank/importLogic';
import { pickBankFile, readIncomingBankFile } from '@/features/bank/pickBankFile';
import { takeBankFile } from '@/features/bank/incomingBankFile';
import { applyAccountImport, statementBalanceStatus } from '@/features/bank/accountImport';
import PDFStatementReader from '@/features/bank/PDFStatementReader';
import { parseCitizensStatement } from '@/features/bank/citizensStatement';
import type { CitizensStatement } from '@/features/bank/citizensStatement';
import { linkAccountTransactions, mergeAccountTransactions } from '@/features/pocket/transactions';
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
  const { bankFileToken } = useLocalSearchParams<{ bankFileToken?: string }>();
  const consumedToken = useRef('');
  const pocket = usePocketStore();
  const hydrated = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [csv, setCSV] = useState<BankCSV | null>(null);
  const [pdfJob, setPDFJob] = useState<{ id: number; name: string; base64: string } | null>(null);
  const [statement, setStatement] = useState<CitizensStatement | null>(null);
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
  const [saveHistory, setSaveHistory] = useState(true);
  const [balanceOverride, setBalanceOverride] = useState<boolean | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [done, setDone] = useState<{ imported: number; skipped: number; savedCents: number; transactionsAdded: number; transactionsUpdated: number; matched: number; balanceUpdated: boolean } | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!pdfJob) return;
    // The host also times out if the native DOM engine fails to load.
    const timer = setTimeout(() => {
      if (request.current !== pdfJob.id) return;
      request.current++; setPDFJob(null); setBusy(false);
      setError('Reading this PDF took too long. Try a smaller statement.');
    }, 45_000);
    return () => clearTimeout(timer);
  }, [pdfJob]);
  const review = useMemo(() => {
    if (!csv || !mapping) return { rows: [], excluded: [], error: '' };
    try { return { ...previewBankCSV(csv, mapping, account, pocket.purchases, pocket.bankImportKeys), error: '' }; }
    catch (cause) { return { rows: [], excluded: [], error: cause instanceof Error ? cause.message : 'Check the selected columns.' }; }
  }, [csv, mapping, account, pocket.purchases, pocket.bankImportKeys]);
  const selectedIds = useMemo(() => new Set(review.rows.filter((row) => row.duplicate !== 'known' &&
    (selectionOverrides.get(row.id) ?? !row.duplicate)).map((row) => row.id)), [review.rows, selectionOverrides]);
  const selected = useMemo(() => review.rows.filter((row) => row.duplicate !== 'known' && selectedIds.has(row.id)), [review.rows, selectedIds]);
  const historyReview = useMemo(() => {
    if (!csv || !mapping || review.error) return { rows: [], excluded: [] };
    return previewAccountTransactions(csv, mapping, account);
  }, [csv, mapping, account, review.error]);
  const history = useMemo(() => linkAccountTransactions(historyReview.rows, review.rows, selectedIds), [historyReview.rows, review.rows, selectedIds]);
  const historyPlan = useMemo(() => mergeAccountTransactions(pocket.accountTransactions, saveHistory ? history : []), [pocket.accountTransactions, history, saveHistory]);
  const matchedRows = useMemo(() => review.rows.filter((row) => row.duplicate === 'possible' && !selectedIds.has(row.id)), [review.rows, selectedIds]);
  const balanceStatus = statement?.balance ? statementBalanceStatus(pocket, statement.balance, account) : 'invalid';
  const updateBalance = !!statement?.balance && !['invalid', 'applied'].includes(balanceStatus) && (balanceOverride ?? balanceStatus === 'new');
  const importOptions = useMemo(() => ({ matches: matchedRows, balance: updateBalance ? statement?.balance : null }), [matchedRows, updateBalance, statement?.balance]);
  const plan = useMemo(() => applyAccountImport(pocket, selected, applyRule && !!pocket.activeGoal, account, saveHistory ? history : [], importOptions), [pocket, selected, applyRule, account, saveHistory, history, importOptions]);
  const canImport = selected.length > 0 || historyPlan.added > 0 || historyPlan.updated > 0 || plan.matched > 0 || plan.balanceUpdated;
  const total = selected.reduce((sum, row) => sum + row.amountCents, 0);

  const load = useCallback((text: string, filename: string) => {
    const parsed = parseBankCSV(text);
    setStatement(null); setBalanceOverride(null);
    setCSV(parsed); setMapping(guessMapping(parsed)); setName(filename); setPaste(''); setShowPaste(false);
    setLimit(20); setShowExcluded(false); setExcludedLimit(20); setDone(null); setError(''); setApplyRule(false);
    setSelectionOverrides(new Map()); setSaveHistory(true); setShowHistory(false); setHistoryLimit(20);
    Keyboard.dismiss();
  }, []);
  useEffect(() => {
    if (!hydrated || !bankFileToken || consumedToken.current === bankFileToken) return;
    const current = ++request.current;
    void Promise.resolve().then(async () => {
      if (current !== request.current) return;
      consumedToken.current = bankFileToken;
      const incoming = takeBankFile(bankFileToken);
      setError(''); setDone(null); setCSV(null); setMapping(null); setStatement(null); setBalanceOverride(null); setBusy(true);
      let readingPDF = false;
      try {
        if (!incoming) throw new Error('This file handoff expired. Choose the statement from Files.');
        const file = await readIncomingBankFile(incoming);
        if (current !== request.current) return;
        if (file.kind === 'csv') load(file.text, file.name);
        else { readingPDF = true; setPDFJob({ id: current, name: file.name, base64: file.base64 }); }
      } catch (cause) {
        if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not open this shared statement. Choose it from Files.');
      } finally { if (current === request.current && !readingPDF) setBusy(false); }
    });
  }, [bankFileToken, hydrated, load]);
  function cancelReading() { request.current++; setPDFJob(null); setBusy(false); }
  async function chooseFile() {
    const current = ++request.current;
    setBusy(true); setError('');
    let readingPDF = false;
    try {
      const file = await pickBankFile();
      if (current !== request.current || !file) return;
      if (file.kind === 'csv') load(file.text, file.name);
      else { readingPDF = true; setStatement(null); setPDFJob({ id: current, name: file.name, base64: file.base64 }); }
    } catch (cause) {
      if (current !== request.current) return;
      const message = cause instanceof Error ? cause.message : '';
      setError(/native module|ExpoDocumentPicker|Cannot find native/i.test(message)
        ? 'File picking needs a rebuilt app. You can paste the CSV below to import now.'
        : message || 'Could not open this file. Choose a PDF or CSV from Files.');
    } finally { if (current === request.current && !readingPDF) setBusy(false); }
  }
  function toggle(id: string) { setSelectionOverrides((previous) => new Map(previous).set(id, !selectedIds.has(id))); }
  function importSelected() {
    if (!hydrated || review.error || !canImport || busy) return;
    const result = pocket.importBankPurchases(selected, applyRule && !!pocket.activeGoal, account, saveHistory ? history : [], importOptions);
    setDone(result); setCSV(null); setMapping(null); setStatement(null); setPaste(''); setSelectionOverrides(new Map()); setError('');
  }
  function columnField(field: Column) {
    return <Pressable key={field} accessibilityRole="button" accessibilityLabel={`Choose ${columnNames[field]} column`}
      onPress={() => setColumn(field)} style={styles.field}>
      <Text style={styles.label}>{columnNames[field]}</Text><Text style={styles.fieldValue}>{mapping && mapping[field] >= 0 ? csv?.headers[mapping[field]] : 'Not selected'} ▾</Text>
    </Pressable>;
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>BANK HISTORY</Text>
      <Text style={styles.title}>Import bank log</Text>
      <Text style={styles.body}>Choose a Citizens checking/savings statement PDF or a bank CSV, then review the transactions. Files are read on your device; imported charges also help find subscriptions.</Text>
      {done ? <View style={styles.card}>
        <Text style={styles.section}>Bank log saved</Text>
        <Text style={styles.body}>{done.transactionsAdded.toLocaleString()} new bank transactions · {done.imported.toLocaleString()} purchases added for goals and subscriptions.</Text>
        {done.balanceUpdated && <Text style={styles.body}>Account balance updated from the statement’s closing balance.</Text>}
        {done.matched > 0 && <Text style={styles.hint}>{done.matched} existing purchase{done.matched === 1 ? '' : 's'} matched to the statement without adding a second purchase.</Text>}
        {done.transactionsUpdated > 0 && <Text style={styles.hint}>{done.transactionsUpdated.toLocaleString()} bank transactions updated.</Text>}
        <Text style={styles.body}>{formatMoney(done.savedCents)} added to the set-aside estimate.</Text>
        {done.skipped > 0 && <Text style={styles.hint}>{done.skipped.toLocaleString()} duplicate or invalid rows weren’t added.</Text>}
        <Button label="Open Account" onPress={() => router.navigate('/pocket')} />
        <Button label="Open savings goals" onPress={() => router.navigate('/investment')} />
        <Button label="Review subscription suggestions" onPress={() => router.navigate('/subscriptions')} />
        <Button label="Choose another file" secondary onPress={() => { setDone(null); void chooseFile(); }} />
      </View> : <>
        {!csv && <View style={styles.card}>
          <Button label={busy ? (pdfJob ? 'Reading PDF…' : 'Choosing file…') : 'Choose bank PDF or CSV'} onPress={() => void chooseFile()} disabled={busy || !hydrated} />
          {busy && <Button label="Cancel" secondary onPress={cancelReading} />}
          <Button label={showPaste ? 'Hide pasted CSV' : 'Or paste CSV'} secondary onPress={() => setShowPaste(!showPaste)} />
          {showPaste && <><TextInput multiline value={paste} onChangeText={setPaste} maxLength={MAX_CSV_BYTES} style={[styles.input, styles.csvInput]}
            autoCorrect={false} autoCapitalize="none" accessibilityLabel="Bank CSV contents" placeholder={'Date,Description,Amount\n10/08/2026,Coffee,-4.50'} />
            <Button label="Review pasted CSV" disabled={!paste.trim() || busy || !hydrated} onPress={() => { try { load(paste, 'Pasted CSV'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this CSV.'); } }} /></>}
          <Button label={showHelp ? 'Hide Citizens setup' : 'Get statements from Citizens'} secondary onPress={() => setShowHelp(!showHelp)} />
          {showHelp && <View style={styles.help}>
            <Text style={styles.section}>Send a PDF to Account</Text>
            <Text style={styles.body}>1. Sign in to Citizens online banking in Safari and open Document Center. Download your checking or savings statement PDF.</Text>
            <Text style={styles.body}>2. Open the PDF, tap Share, then choose GasFinder (or Open in GasFinder). The app will read it and open this review automatically.</Text>
            <Text style={styles.body}>3. Check the transactions and closing balance, then save the import.</Text>
            <Text style={styles.hint}>If GasFinder isn’t listed, use Save to Files, then choose the PDF here. Opening PDFs in GasFinder requires the latest app build.</Text>
            <Text style={styles.hint}>Citizens requires your sign-in to download statements. This handoff automates reading the downloaded PDF; it does not sign in to your bank.</Text>
          </View>}
          <Text style={styles.hint}>Citizens checking/savings PDF: up to 10 MB / 40 pages. Download the original statement from Citizens, rather than a scan or photo. CSV, TSV or text exports: up to 2 MB / 5,000 rows.</Text>
        </View>}
        {csv && mapping && <>
          <View style={styles.card}>
            <View style={styles.rowBetween}><Text style={styles.section}>{statement ? 'Citizens statement' : 'Check columns'}</Text><Button label="Change file" secondary onPress={() => { cancelReading(); setCSV(null); setMapping(null); setStatement(null); setError(''); }} /></View>
            <Text style={styles.hint}>{name} · {csv.rows.length.toLocaleString()} rows</Text>
            <Text style={styles.label}>Account nickname</Text>
            <TextInput value={account} onChangeText={setAccountDraft} maxLength={60} style={styles.input} accessibilityLabel="Bank account nickname" placeholder="Main checking" />
            <Text style={styles.hint}>Use this same nickname next time to prevent repeat imports.</Text>
            {statement && <><Text style={styles.body}>{statement.pages} pages · {statement.periods.join(' · ')}</Text><Text style={styles.hint}>Check every amount against your statement. Credits, transfers, checks and fees are excluded from purchase totals. Spending is included in Account history.</Text>
              {statement.pageCounts.map((page) => <Text key={page.page} style={styles.hint}>Page {page.page}: {page.spending} spending · {page.credits} credits</Text>)}
              {statement.warnings.length > 0 && <><Text style={styles.error}>{statement.warnings.length} reading warnings. Review these in the original PDF:</Text>{statement.warnings.slice(0, excludedLimit).map((warning, index) => <Text key={index} style={styles.hint}>Page {warning.page}, line {warning.line}: {warning.reason}</Text>)}{excludedLimit < statement.warnings.length && <Button label="Show more unreadable rows" secondary onPress={() => setExcludedLimit(excludedLimit + 30)} />}</>}
            </>}
            {!statement && <>{columnField('date')}{columnField('description')}
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
            <Text style={styles.hint}>USD only. Check the spending direction and exclude transfers or card payments before importing.</Text></>}
          </View>
          {review.error ? <Text accessibilityRole="alert" style={styles.error}>{review.error}</Text> : <View style={styles.card}>
            <Text style={styles.section}>Review purchases</Text>
            <Text style={styles.hint}>Possible matches start unchecked and will link to the existing app purchase. Select a match only if it is a different purchase. One app purchase can match only one statement row.</Text>
            <View style={styles.row}><Button label="Select new rows" secondary onPress={() => setSelectionOverrides(new Map(review.rows.map((row) => [row.id, !row.duplicate])))} /><Button label="Clear selection" secondary onPress={() => setSelectionOverrides(new Map(review.rows.map((row) => [row.id, false])))} /></View>
            {review.rows.length === 0 && <Text style={styles.body}>No new spending rows found. Check the statement or selected columns above.</Text>}
            {review.rows.slice(0, limit).map((row) => <View key={`${row.id}-${row.rowNumber}`} style={styles.transaction}>
              <Check checked={row.duplicate !== 'known' && selectedIds.has(row.id)} disabled={row.duplicate === 'known'} label={`Import ${row.title}, ${formatMoney(row.amountCents)}, ${row.pageNumber ? `PDF page ${row.pageNumber}, line ${row.lineNumber}` : `row ${row.rowNumber}`}`} onPress={() => toggle(row.id)} />
              <View style={styles.transactionMain}><View style={styles.rowBetween}><Text style={styles.transactionTitle}>{row.title}</Text><Text style={styles.amount}>{formatMoney(row.amountCents)}</Text></View>
                <Text style={styles.hint}>{new Date(row.purchasedAt).toLocaleDateString()} · {row.pageNumber ? `PDF page ${row.pageNumber}, line ${row.lineNumber}` : `row ${row.rowNumber}`}</Text>
                {row.duplicate && <Text style={styles.match}>{row.duplicate === 'known' ? 'Already imported' : `Possible match (same amount, nearby date) to “${row.matchTitle}”. Include only if this is a different purchase.`}</Text>}
              </View>
            </View>)}
            {limit < review.rows.length && <Button label="Show more rows" secondary onPress={() => setLimit(limit + 30)} />}
            {review.excluded.length > 0 && <><Button label={`${showExcluded ? 'Hide' : 'Show'} ${review.excluded.length.toLocaleString()} skipped row${review.excluded.length === 1 ? '' : 's'}`} secondary onPress={() => setShowExcluded(!showExcluded)} />
              {showExcluded && <>{review.excluded.slice(0, excludedLimit).map((row) => <Text key={row.rowNumber} style={styles.hint}>{csv.locations?.[row.rowNumber - 2] ? `PDF page ${csv.locations[row.rowNumber - 2].page}, line ${csv.locations[row.rowNumber - 2].line}` : `Row ${row.rowNumber}`}: {row.reason}</Text>)}
                {excludedLimit < review.excluded.length && <Button label="Show more skipped rows" secondary onPress={() => setExcludedLimit(excludedLimit + 30)} />}</>}
            </>}
          </View>}
          {!review.error && <View style={styles.card}>
            <View style={styles.ruleRow}><Check checked={saveHistory} label="Save bank history to Account" onPress={() => setSaveHistory(!saveHistory)} /><View style={styles.transactionMain}><Text style={styles.transactionTitle}>Save bank history to Account</Text><Text style={styles.hint}>{historyReview.rows.length.toLocaleString()} readable transactions, including spending, deposits, transfers and fees.</Text></View></View>
            <Text style={styles.hint}>Bank history is separate from the purchases selected above. Deposits, transfers and fees won’t trigger a savings rule. The balance update is reviewed below.</Text>
            <Button label={`${showHistory ? 'Hide' : 'Review'} bank history`} secondary onPress={() => setShowHistory(!showHistory)} />
            {showHistory && <>{historyReview.rows.slice(0, historyLimit).map((row) => <View key={`${row.id}-${row.rowNumber}`} style={styles.historyRow}>
              <View style={styles.rowBetween}><Text style={styles.transactionTitle}>{row.title}</Text><Text style={styles.amount}>{row.amountCents > 0 ? '+' : '−'}{formatMoney(Math.abs(row.amountCents))}</Text></View>
              <Text style={styles.hint}>{new Date(row.occurredAt).toLocaleDateString()} · {row.status === 'recorded' ? 'Posting status not supplied' : row.status === 'pending' ? 'Pending' : 'Posted'} · {csv.locations?.[row.rowNumber - 2] ? `PDF page ${csv.locations[row.rowNumber - 2].page}` : `row ${row.rowNumber}`}</Text>
            </View>)}{historyLimit < historyReview.rows.length && <Button label="Show more bank history" secondary onPress={() => setHistoryLimit(historyLimit + 30)} />}</>}
            {historyReview.excluded.length > 0 && <Text style={styles.hint}>{historyReview.excluded.length.toLocaleString()} invalid, non-USD or empty rows won’t be saved to bank history.</Text>}
            {saveHistory && <Text style={styles.body}>{historyPlan.added} new · {historyPlan.updated} updated bank transactions</Text>}
          </View>}
          {statement && <View style={styles.card}>
            <Text style={styles.section}>Statement balance</Text>
            {statement.balance ? <>
              <View style={styles.ruleRow}><Check checked={updateBalance} disabled={balanceStatus === 'applied' || balanceStatus === 'invalid'} label="Update Account with statement closing balance" onPress={() => setBalanceOverride(!updateBalance)} /><View style={styles.transactionMain}><Text style={styles.transactionTitle}>{formatMoney(statement.balance.amountCents)} · {new Date(`${statement.balance.asOf}T12:00:00`).toLocaleDateString()}</Text><Text style={styles.hint}>Closing balance · PDF page {statement.balance.page}</Text></View></View>
              <Text style={styles.hint}>{balanceStatus === 'applied' ? 'This statement balance has already been applied. Reimporting won’t replace a balance you updated later.' : balanceStatus === 'older' ? 'This statement is older than your saved balance. Select only if you want to replace it.' : 'Update Account with this closing balance. Your money set aside stays the same.'}</Text>
              <Text style={styles.hint}>A statement shows the balance on its closing date. Later purchases and deposits may have changed it.</Text>
            </> : <Text style={styles.hint}>No clear closing balance was found. Update your balance manually in Account.</Text>}
          </View>}
          <View style={styles.card}>
            <Text style={styles.section}>{selected.length.toLocaleString()} selected · {formatMoney(total)}</Text>
            {pocket.activeGoal ? <View style={styles.ruleRow}>
              <Check checked={applyRule} label="Apply current goal rule to imported purchases" onPress={() => setApplyRule(!applyRule)} />
              <View style={styles.transactionMain}><Text style={styles.transactionTitle}>Apply my goal’s rule</Text><Text style={styles.hint}>{ruleDescription(pocket.activeGoal.setAsideRule)}</Text></View>
            </View> : <Text style={styles.hint}>Create a goal later to use this spending history for savings suggestions.</Text>}
            <Text style={styles.body}>{formatMoney(plan.savedCents)} will be added to the set-aside estimate{applyRule ? ', capped by your goal and entered balance' : ''}.</Text>
            <Text style={styles.hint}>{updateBalance ? 'Your Account balance will be updated to the closing balance above. Transactions won’t be subtracted a second time.' : 'Your saved Account balance will stay as entered.'} Money stays in your bank account.</Text>
            <Button label={selected.length ? `Import ${selected.length.toLocaleString()} purchase${selected.length === 1 ? '' : 's'}` : 'Save statement'} disabled={!canImport || !!review.error || !hydrated || busy} onPress={importSelected} />
          </View>
        </>}
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </FormScrollView>
    {pdfJob && <PDFStatementReader key={pdfJob.id} base64={pdfJob.base64} dom={{ style: { width: 1, height: 1 }, scrollEnabled: false }} onRead={async (pages) => {
      if (request.current !== pdfJob.id) return;
      try {
        const parsed = parseCitizensStatement(pages);
        setStatement(parsed); setBalanceOverride(null); setCSV(parsed.csv); setMapping(guessMapping(parsed.csv)); setName(pdfJob.name);
        setPaste(''); setShowPaste(false); setLimit(20); setShowExcluded(false); setExcludedLimit(20);
        setDone(null); setError(''); setApplyRule(false); setSelectionOverrides(new Map()); setSaveHistory(true); setShowHistory(false); setHistoryLimit(20); Keyboard.dismiss();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this Citizens statement.'); }
      finally { setPDFJob(null); setBusy(false); }
    }} onError={async (message) => { if (request.current === pdfJob.id) { setError(message); setPDFJob(null); setBusy(false); } }} />}
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
  help: { gap: 12, paddingTop: 8 },
  historyRow: { gap: 5, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 }, scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 }, modal: { maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 12, padding: 15 }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }, option: { minHeight: 48, padding: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
});
