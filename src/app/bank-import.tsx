import { PrivacyModal as Modal } from '@/features/privacy/PrivacyModal';
import { useValidationAnnouncement } from '@/components/useValidationAnnouncement';
import { useReducedMotion } from '@/components/useReducedMotion';
import { useSavedDraft } from '@/features/drafts/useSavedDraft';
import { useDraftGuard } from '@/components/useDraftGuard';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { readScannedStatement, scannedReadingAvailable } from '@/features/bank/scannedStatement';
import { findBatchItem, batchBalanceAllowed, batchDecisionMade, updateBatch, startBatch } from '@/features/bank/batch';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { IconButton } from '@/components/IconButton';
import { needsAmountDirectionReview, guessMapping, parseBankCSV, previewAccountTransactions, previewBankCSV } from '@/features/bank/importLogic';
import type { BankCSV, BankMapping } from '@/features/bank/importLogic';
import { pickBankFiles, readIncomingBankFile } from '@/features/bank/pickBankFile';
import type { BankFile } from '@/features/bank/bankFileTypes';
import { readBankImport, saveBankImport, saveImportOutcome } from '@/features/bank/importArchive';
import { recoverableBankOperation } from '@/features/data/backupService';
import type { SavedBankImport } from '@/features/bank/archiveLogic';
import { takeBankFile } from '@/features/bank/incomingBankFile';
import { applyAccountImport, statementBalanceStatus } from '@/features/bank/accountImport';
import { importSharedStatement, prepareAutomaticStatement } from '@/features/bank/statementAutomation';
import type { StatementBalanceChoice } from '@/features/bank/statementAutomation';
import { bankTransactionName } from '@/features/bank/merchantName';
import PDFStatementReader from '@/features/bank/PDFStatementReader';
import { parseCitizensStatement } from '@/features/bank/citizensStatement';
import type { CitizensStatement } from '@/features/bank/citizensStatement';
import { linkAccountTransactions, mergeAccountTransactions } from '@/features/pocket/transactions';
import { ruleDescription } from '@/features/goals/logic';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { useStatementAutomationStore } from '@/stores/statementAutomationStore';
import { accountContains, inferLinkedAccount, resolveLinkedAccount } from '@/features/bank/accountIdentity';
import StatementChecks from '@/features/bank/StatementChecks';

type Column = Exclude<keyof BankMapping, 'mode' | 'spendingSign' | 'dateOrder'>;
const columnNames: Record<Column, string> = { date: 'Date', description: 'Description', amount: 'Amount', debit: 'Debit / money out', credit: 'Credit / money in', currency: 'Currency', type: 'Transaction type', status: 'Status', transactionId: 'Transaction ID' };

function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  useThemeRevision();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}
function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  useThemeRevision();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.choiceText, selected && styles.selectedText]}>{label}</Text>
  </Pressable>;
}
function Check({ checked, label, onPress, disabled = false }: { checked: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  useThemeRevision();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} aria-checked={checked} disabled={disabled} onPress={onPress} style={styles.checkButton}>
    <View style={[styles.check, checked && styles.selected, disabled && styles.disabled]}><Text style={styles.selectedText}>{checked ? '✓' : ''}</Text></View>
  </Pressable>;
}

export default function BankImportScreen() {
  useThemeRevision();
  const reduced = useReducedMotion();
  const { bankFileToken, archiveId, batchToken } = useLocalSearchParams<{ bankFileToken?: string; archiveId?: string; batchToken?: string }>();
  const consumedBatch = useRef('');
  const consumedToken = useRef('');
  const consumedArchive = useRef('');
  const processedPDF = useRef(0);
  const pocket = usePocketStore();
  const automation = useStatementAutomationStore();
  const hydrated = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const automationHydrated = useSyncExternalStore(useStatementAutomationStore.persist.onFinishHydration, useStatementAutomationStore.persist.hasHydrated, () => false);
  const [csv, setCSV] = useState<BankCSV | null>(null);
  const [pdfJob, setPDFJob] = useState<{ id: number; name: string; base64: string; file: BankFile; shared: boolean } | null>(null);
  const [statement, setStatement] = useState<CitizensStatement | null>(null);
  const [sourceFile, setSourceFile] = useState<BankFile | null>(null);
  const [mapping, setMapping] = useState<BankMapping | null>(null);
  const [name, setName] = useState('');
  const [accountDraft, setAccountDraft] = useState<string | null>(null);
  const account = accountDraft ?? pocket.linkedBankAccount?.nickname ?? pocket.bankImportAccountLabel;
  const accountIdentity = useMemo(() => {
    try {
      const legacy = inferLinkedAccount(pocket);
      const guarded = legacy && !legacy.statementIdentifier && automation.confirmedAccountIdentifier && accountContains(legacy, automation.accountLabel)
        ? { ...legacy, statementIdentifier: automation.confirmedAccountIdentifier } : legacy;
      return { value: resolveLinkedAccount({ ...pocket, linkedBankAccount: guarded }, account, statement?.accountIdentifier), error: '' };
    } catch (error) { return { value: null, error: error instanceof Error ? error.message : 'Check the bank account.' }; }
  }, [pocket, account, statement, automation.confirmedAccountIdentifier, automation.accountLabel]);
  const accountRef = accountIdentity.value ?? account;
  const [mismatchReviewed, setMismatchReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [automaticSaving, setAutomaticSaving] = useState(false);
  const [pendingAutomatic, setPendingAutomatic] = useState<{ id: number; statement: CitizensStatement; file: BankFile; accountLabel: string } | null>(null);
  const [error, setError] = useState('');
  useValidationAnnouncement(error);
  const [directionConfirmed, setDirectionConfirmed] = useState(false);
  const [scanned, setScanned] = useState(false), [scanReviewed, setScanReviewed] = useState(false);
  const [automaticReview, setAutomaticReview] = useState('');
  const [column, setColumn] = useState<Column | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [selectionOverrides, setSelectionOverrides] = useState<Map<string, boolean>>(new Map());
  const [limit, setLimit] = useState(20);
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludedLimit, setExcludedLimit] = useState(20);
  const [applyRule, setApplyRule] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [balanceDraftOverride, setBalanceOverride] = useState<boolean | null>(null);
  const balanceOverride = batchToken && !batchBalanceAllowed(batchToken) ? false : balanceDraftOverride;
  const [reviewOptions, setReviewOptions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [done, setDone] = useState<{ imported: number; skipped: number; savedCents: number; transactionsAdded: number; transactionsUpdated: number; matched: number; balanceUpdated: boolean; automatic?: boolean } | null>(null);
  const guard = useDraftGuard({ file: sourceFile?.name, accountDraft, mapping, applyRule, saveHistory, balanceDraftOverride, selection: [...selectionOverrides] }, true, !done && !!sourceFile);

  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!pdfJob) return;
    // The host also times out if the native DOM engine fails to load.
    const timer = setTimeout(() => {
      if (request.current !== pdfJob.id || processedPDF.current === pdfJob.id) return;
      processedPDF.current = pdfJob.id;
      request.current++; setPDFJob(null); setBusy(false);
      setError('Reading this PDF took too long. Try a smaller statement.');
    }, 45_000);
    return () => clearTimeout(timer);
  }, [pdfJob]);
  const review = useMemo(() => {
    if (!csv || !mapping) return { rows: [], excluded: [], error: '' };
    try { return { ...previewBankCSV(csv, mapping, accountRef, pocket.purchases, pocket.bankImportKeys), error: '' }; }
    catch (cause) { return { rows: [], excluded: [], error: cause instanceof Error ? cause.message : 'Check the selected columns.' }; }
  }, [csv, mapping, accountRef, pocket.purchases, pocket.bankImportKeys]);
  const selectedIds = useMemo(() => new Set(review.rows.filter((row) => row.duplicate !== 'known' &&
    (selectionOverrides.get(row.id) ?? !row.duplicate)).map((row) => row.id)), [review.rows, selectionOverrides]);
  const selected = useMemo(() => review.rows.filter((row) => row.duplicate !== 'known' && selectedIds.has(row.id)), [review.rows, selectedIds]);
  const historyReview = useMemo(() => {
    if (!csv || !mapping || review.error) return { rows: [], excluded: [] };
    return previewAccountTransactions(csv, mapping, accountRef);
  }, [csv, mapping, accountRef, review.error]);
  const history = useMemo(() => linkAccountTransactions(historyReview.rows, review.rows, selectedIds), [historyReview.rows, review.rows, selectedIds]);
  const historyPlan = useMemo(() => mergeAccountTransactions(pocket.accountTransactions, saveHistory ? history : [], undefined, pocket.transactionDirections), [pocket.accountTransactions, history, saveHistory, pocket.transactionDirections]);
  const matchedRows = useMemo(() => review.rows.filter((row) => row.duplicate === 'possible' && !selectedIds.has(row.id)), [review.rows, selectedIds]);
  const balanceStatus = statement?.balance ? statementBalanceStatus(pocket, statement.balance, accountRef) : 'invalid';
  const needsBalanceChoice = !!statement?.balance && balanceStatus !== 'invalid';
  const updateBalance = (!batchToken || batchBalanceAllowed(batchToken)) && needsBalanceChoice && balanceStatus !== 'applied' && balanceOverride === true;
  const importOptions = useMemo(() => ({ matches: matchedRows, balance: updateBalance ? statement?.balance : null, statementIdentifier: statement?.accountIdentifier }), [matchedRows, updateBalance, statement?.balance, statement?.accountIdentifier]);
  const plan = useMemo(() => accountIdentity.error ? { imported: 0, skipped: 0, savedCents: 0, matched: 0, balanceUpdated: false } : applyAccountImport(pocket, selected, applyRule && !!pocket.activeGoal, accountRef, saveHistory ? history : [], importOptions), [pocket, selected, applyRule, accountRef, saveHistory, history, importOptions, accountIdentity.error]);
  const directionUnconfirmed = !!csv && !!mapping && needsAmountDirectionReview(csv,mapping) && !directionConfirmed;
  const scanBlocked = scanned && (!scanReviewed || statement?.reconciliation?.status !== 'matched');
  const canImport = !directionUnconfirmed && !scanBlocked && (sourceFile !== null || selected.length > 0 || historyPlan.added > 0 || historyPlan.updated > 0 || plan.matched > 0 || plan.balanceUpdated);
  const purchaseRows = useMemo(() => [...review.rows].sort((a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt)), [review.rows]);
  const historyRows = useMemo(() => [...historyReview.rows].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)), [historyReview.rows]);

  const load = useCallback((text: string, filename: string) => {
    const parsed = parseBankCSV(text);
    setStatement(null); setBalanceOverride(null); setMismatchReviewed(false); setDirectionConfirmed(false);
    setCSV(parsed); setMapping(guessMapping(parsed)); setName(filename); setReviewOptions(false);
    setLimit(20); setShowExcluded(false); setExcludedLimit(20); setDone(null); setError(''); setApplyRule(false);
    setSelectionOverrides(new Map()); setSaveHistory(true); setShowHistory(false); setHistoryLimit(20);
    setAutomaticReview(''); setPendingAutomatic(null);
    Keyboard.dismiss();
  }, []);
  const openFile = useCallback((file: BankFile, current: number, shared = false) => {
    setScanned(false); setScanReviewed(false); setReviewOptions(false); setSourceFile(file); setCSV(null); setMapping(null); setStatement(null); setBalanceOverride(null); setMismatchReviewed(false); setDone(null);
    setAutomaticReview(''); setPendingAutomatic(null);
    if (file.kind === 'csv') { load(file.text, file.name); setBusy(false); }
    else setPDFJob({ id: current, name: file.name, base64: file.base64, file, shared });
  }, [load]);
  const savedDraft = useSavedDraft('bank-import', sourceFile, !!sourceFile && !done, file => { if (file) { openFile(file, ++request.current); setAutomaticReview('Source file resumed. Review choices and balance consent are reset; check them before saving.'); } }, !batchToken && !archiveId && !bankFileToken);
  useEffect(() => {
    if (!hydrated || !automationHydrated || !batchToken || consumedBatch.current === batchToken) return;
    consumedBatch.current = batchToken;
    const item = findBatchItem(batchToken);
    void Promise.resolve().then(() => {
      if (!item || !batchDecisionMade()) { setError('Return to Import a batch and choose its balance option first.'); return; }
      openFile(item.file, ++request.current); setBusy(item.file.kind === 'pdf');
    });
  }, [hydrated, automationHydrated, batchToken, openFile]);
  useEffect(() => {
    if (!hydrated || !automationHydrated || !bankFileToken || consumedToken.current === bankFileToken) return;
    const current = ++request.current;
    void Promise.resolve().then(async () => {
      if (current !== request.current) return;
      consumedToken.current = bankFileToken;
      const incoming = takeBankFile(bankFileToken);
      setError(''); setDone(null); setCSV(null); setMapping(null); setStatement(null); setBalanceOverride(null); setMismatchReviewed(false); setPendingAutomatic(null); setBusy(true);
      let readingPDF = false;
      try {
        if (!incoming) throw new Error('This file handoff expired. Choose the statement from Files.');
        const file = await readIncomingBankFile(incoming);
        if (current !== request.current) return;
        const setup = useStatementAutomationStore.getState();
        if (setup.enabled && setup.accountLabel) setAccountDraft(setup.accountLabel);
        readingPDF = file.kind === 'pdf'; openFile(file, current, true);
      } catch (cause) {
        if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not open this shared statement. Choose it from Files.');
      } finally { if (current === request.current && !readingPDF) setBusy(false); }
    });
  }, [bankFileToken, hydrated, automationHydrated, openFile]);
  useEffect(() => {
    if (!hydrated || !archiveId || consumedArchive.current === archiveId) return;
    const current = ++request.current;
    let readingPDF = false;
    void Promise.resolve().then(async () => {
      if (current !== request.current) return;
      consumedArchive.current = archiveId; setBusy(true); setError(''); setCSV(null); setMapping(null); setSourceFile(null); setPendingAutomatic(null);
      try {
        const { file, entry } = await readBankImport(archiveId);
        if (current !== request.current) return;
        setAccountDraft(usePocketStore.getState().linkedBankAccount?.nickname ?? entry.accountLabel);
        readingPDF = file.kind === 'pdf'; openFile(file, current);
      } catch (cause) {
        if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not reopen this saved import.');
      } finally { if (current === request.current && !readingPDF) setBusy(false); }
    });
  }, [archiveId, hydrated, openFile]);
  function cancelReading() { request.current++; setPDFJob(null); setPendingAutomatic(null); setBusy(false); setAutomaticSaving(false); setAutomaticReview(''); }

  function prepareSharedStatement(parsed: CitizensStatement, nickname: string) {
    const setup = useStatementAutomationStore.getState();
    return setup.accountLabel.toLowerCase() !== nickname.trim().toLowerCase()
      ? { status: 'review' as const, reason: 'Your import account changed while this PDF was being read. Review the account nickname before saving.' }
      : prepareAutomaticStatement(setup, true, parsed, usePocketStore.getState());
  }

  async function saveSharedStatement(balanceChoice: StatementBalanceChoice) {
    if (!pendingAutomatic || busy || request.current !== pendingAutomatic.id) return;
    const pending = pendingAutomatic;
    const current = ++request.current;
    setPendingAutomatic(null); setBusy(true); setAutomaticSaving(true); setError('');
    try {
      const result = await recoverableBankOperation(async permit => {
        let saved: SavedBankImport | undefined;
        const outcome = await importSharedStatement({
          balanceChoice,
          prepare: () => prepareSharedStatement(pending.statement, pending.accountLabel),
          isCurrent: () => request.current === current,
          archive: async automatic => { saved = await permit(() => saveBankImport(pending.file, { accountLabel: automatic.accountLabel, transactionCount: automatic.transactionCount,
            purchaseCount: automatic.purchaseCount, balanceCents: automatic.balance.amountCents, balanceAsOf: automatic.balance.asOf,
            periods: pending.statement.periods, transactionIds: automatic.history.map(row => row.id) })); },
          commit: (automatic, balance) => permit(() => usePocketStore.getState().importBankPurchases(automatic.purchases, false, automatic.account, automatic.history, { balance, statementIdentifier: pending.statement.accountIdentifier })),
        });
        if (outcome.status === 'saved' && saved) {
          await permit(() => saveImportOutcome(saved!.id, { importReport: { parser: 'citizens-pdf-v3', excludedRows: pending.statement.warnings.length,
            matched: outcome.result.matched, added: outcome.result.transactionsAdded, balanceUpdated: outcome.result.balanceUpdated, savedCents: outcome.result.savedCents, checks: pending.statement.reconciliation?.status ?? 'unverified' } }));
          permit(() => useStatementAutomationStore.getState().confirmImport(pending.accountLabel, pending.statement.accountIdentifier,
            { name: pending.file.name, importedAt: new Date().toISOString(), balanceAsOf: pending.statement.balance!.asOf, automatic: true }));
        }
        return outcome;
      });
      if (request.current !== current || result.status === 'canceled') return;
      if (result.status === 'review') setAutomaticReview(result.reason);
      else {
        guard.accept(); await savedDraft.clear().catch(() => undefined);
        setDone({ ...result.result, automatic: true }); setCSV(null); setMapping(null); setStatement(null); setSourceFile(null);
      }
    } catch (cause) {
      if (request.current === current) setError(cause instanceof Error ? cause.message : 'Could not save this statement. Review it and try again.');
    } finally { if (request.current === current) { setBusy(false); setAutomaticSaving(false); } }
  }
  async function chooseFileUnchecked() {
    const current = ++request.current;
    setPendingAutomatic(null);
    setBusy(true); setError('');
    let readingPDF = false;
    try {
      const files = await pickBankFiles();
      if (current !== request.current || !files.length) return;
      if (files.length > 1) { startBatch(files); router.push('/bank-batch'); return; }
      const file = files[0];
      readingPDF = file.kind === 'pdf'; openFile(file, current);
    } catch (cause) {
      if (current !== request.current) return;
      const message = cause instanceof Error ? cause.message : '';
      setError(/native module|ExpoDocumentPicker|Cannot find native/i.test(message)
        ? 'File picking needs the latest app build. Update Tally and choose your PDF or CSV again.'
        : message || 'Could not open this file. Choose a PDF or CSV from Files.');
    } finally { if (current === request.current && !readingPDF) setBusy(false); }
  }
  function chooseFile() { guard.confirm(() => { void chooseFileUnchecked(); }); }
  function toggle(id: string) { setSelectionOverrides((previous) => new Map(previous).set(id, !selectedIds.has(id))); }
  async function importSelected() {
    if (batchToken && !batchDecisionMade()) { setError('Choose the batch balance option first.'); return; }
    if (!hydrated || !automationHydrated || review.error || accountIdentity.error || !canImport || busy || pendingAutomatic || statement?.reconciliation?.status === 'mismatch' && !mismatchReviewed || (needsBalanceChoice && balanceOverride === null)) return;
    const current = ++request.current;
    const reviewedState = usePocketStore.getState();
    setBusy(true); setError('');
    try {
      const result = await recoverableBankOperation(async permit => {
        const saved = sourceFile ? await permit(() => saveBankImport(sourceFile, { accountLabel: account.trim(), transactionCount: historyReview.rows.length, purchaseCount: review.rows.length,
          transactionIds: saveHistory ? history.map(row => row.id) : [], periods: statement?.periods,
          ...(statement?.balance ? { balanceCents: statement.balance.amountCents, balanceAsOf: statement.balance.asOf } : {}),
        })) : undefined;
        if (current !== request.current) throw new Error('Import was canceled. Review the file again.');
        const liveState = usePocketStore.getState();
        if (liveState !== reviewedState) throw new Error('Your account changed. Review the updated preview and balance choice before importing.');
        const outcome = permit(() => liveState.importBankPurchases(selected, applyRule && !!pocket.activeGoal, accountRef, saveHistory ? history : [], importOptions));
        if (saved) await permit(() => saveImportOutcome(saved.id, { importReport: { parser: scanned ? 'citizens-scanned-reviewed-v1' : statement ? 'citizens-pdf-v3' : 'csv-v1', excludedRows: historyReview.excluded.length,
          matched: outcome.matched, added: outcome.transactionsAdded, balanceUpdated: outcome.balanceUpdated, savedCents: outcome.savedCents, checks: statement?.reconciliation?.status === 'mismatch' && mismatchReviewed ? 'mismatch acknowledged' : statement?.reconciliation?.status ?? 'unverified' } }));
        permit(() => { const setup = useStatementAutomationStore.getState(); setup.configure(setup.enabled, account);
          if (sourceFile && statement?.balance) useStatementAutomationStore.getState().confirmImport(account, statement.accountIdentifier,
            { name: sourceFile.name, importedAt: new Date().toISOString(), balanceAsOf: statement.balance.asOf, automatic: false }); });
        return outcome;
      });
      if (batchToken) updateBatch(batchToken, { saved: true });
      guard.accept(); await savedDraft.clear().catch(() => undefined); setDone(result); setCSV(null); setMapping(null); setStatement(null); setSourceFile(null); setSelectionOverrides(new Map());
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not save the file in Imports. Try again.');
    } finally { if (current === request.current) setBusy(false); }
  }
  function columnField(field: Column) {
    return <Pressable key={field} accessibilityRole="button" accessibilityLabel={`Choose ${columnNames[field]} column`}
      onPress={() => { setReviewOptions(true); setColumn(field); }} style={styles.field}>
      <Text style={styles.label}>{columnNames[field]}</Text><Text style={styles.fieldValue}>{mapping && mapping[field] >= 0 ? csv?.headers[mapping[field]] : 'Not selected'} ▾</Text>
    </Pressable>;
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      {savedDraft.panel}{guard.dialog}{sourceFile && !batchToken && !busy && !done && <Button label="Discard import draft" secondary onPress={() => guard.confirm(() => { void savedDraft.clear().then(() => { guard.accept(); setSourceFile(null); setCSV(null); setStatement(null); setMapping(null); setError(''); }).catch(() => setError('Could not discard this draft. Try again.')); }, false)} />}
      <Text accessibilityRole="header" style={styles.title}>Import statement</Text>
      {done ? <View style={styles.card}>
        <Text style={styles.section}>{done.automatic ? 'Statement imported' : 'Import saved'}</Text>
        <Text style={styles.body}>{done.transactionsAdded.toLocaleString()} new bank transactions · {done.imported.toLocaleString()} purchases added for goals and subscriptions.</Text>
        <Text style={styles.hint}>Your file is saved in Imports.</Text>
        {done.balanceUpdated && <Text style={styles.body}>Account balance updated from the statement’s closing balance.</Text>}
        {done.matched > 0 && <Text style={styles.hint}>{done.matched} existing purchase{done.matched === 1 ? '' : 's'} matched to the statement without adding a second purchase.</Text>}
        {done.transactionsUpdated > 0 && <Text style={styles.hint}>{done.transactionsUpdated.toLocaleString()} bank transactions updated.</Text>}
        {done.savedCents > 0 && <Text style={styles.body}>{formatMoney(done.savedCents)} added to the set-aside estimate.</Text>}
        {done.skipped > 0 && <Text style={styles.hint}>{done.skipped.toLocaleString()} duplicate or invalid rows weren’t added.</Text>}
        <Button label="Open Account" onPress={() => router.navigate('/pocket')} />
        <Pressable accessibilityRole="button" style={styles.smallLink} onPress={() => router.push('/bank-imports')}><Text style={styles.linkText}>Saved imports ›</Text></Pressable>
        {batchToken && <Button label="Back to batch" secondary onPress={() => router.back()} />}
        {!batchToken && <Button label="Choose another file" secondary onPress={() => { setDone(null); void chooseFile(); }} />}
      </View> : <>
        {(!csv || automaticSaving) && <View style={styles.landing}>
          <Button label={busy ? (automaticSaving ? 'Saving shared statement…' : pdfJob ? 'Reading PDF…' : 'Opening file…') : 'Choose bank PDF or CSV'} onPress={() => void chooseFile()} disabled={busy || !hydrated || !!batchToken} />
          {batchToken && <Button label="Back to batch" secondary onPress={() => router.back()} />}
          <Pressable accessibilityRole="button" style={styles.smallLink} onPress={() => router.push('/bank-imports')}><Text style={styles.linkText}>Saved imports ›</Text></Pressable>
          {busy && <Button label="Cancel" secondary onPress={cancelReading} />}
        </View>}
        {csv && mapping && !automaticSaving && <>
          {automaticReview ? <View style={styles.card}><Text style={styles.section}>A quick review is needed</Text><Text style={styles.body}>{automaticReview}</Text></View> : null}
          <View style={styles.card}>
            <View style={styles.rowBetween}><Text style={styles.section}>Selected file</Text><Pressable accessibilityRole="button" style={styles.smallLink} disabled={busy || !!batchToken} onPress={() => void chooseFile()}><Text style={styles.linkText}>Change file</Text></Pressable></View>
            <Text style={styles.body}>{name}</Text>
            <Text style={styles.hint}>{account} · {historyReview.rows.length.toLocaleString()} bank transactions · {directionUnconfirmed ? 'confirm amount direction below' : `${selected.length.toLocaleString()} new purchases`}</Text>
            {matchedRows.length > 0 && <Text style={styles.hint}>{matchedRows.length} possible purchase match{matchedRows.length === 1 ? '' : 'es'} will link to existing purchases. Use Import options if these were separate purchases.</Text>}
            {statement && <Text style={styles.hint}>{statement.pages} pages · {statement.periods.join(' · ')}</Text>}
            {statement && statement.warnings.length > 0 && <><Text style={styles.error}>{statement.warnings.length} reading warnings. Review these in the original PDF:</Text>{statement.warnings.slice(0, excludedLimit).map((warning, index) => <Text key={index} style={styles.hint}>Page {warning.page}, line {warning.line}: {warning.reason}</Text>)}{excludedLimit < statement.warnings.length && <Button label="Show more unreadable rows" secondary onPress={() => setExcludedLimit(excludedLimit + 30)} />}</>}
          </View>
          {accountIdentity.error && <Text accessibilityRole="alert" style={styles.error}>{accountIdentity.error}</Text>}
          {statement?.reconciliation && <StatementChecks value={statement.reconciliation} />}
          {statement?.reconciliation?.status === 'mismatch' && <View style={styles.card}><Text style={styles.body}>Check the mismatched totals against the original PDF before importing.</Text><View style={styles.row}><Check checked={mismatchReviewed} label="I reviewed the statement totals mismatch" onPress={() => setMismatchReviewed(!mismatchReviewed)} /><Text style={[styles.body, { flex: 1 }]}>I reviewed the statement totals mismatch</Text></View></View>}
          {statement && <View style={styles.card}>
            <Text style={styles.section}>Use the PDF’s balance?</Text>
            {statement.balance ? <>
              <Text style={styles.transactionTitle}>{formatMoney(statement.balance.amountCents)} · {new Date(`${statement.balance.asOf}T12:00:00`).toLocaleDateString()}</Text>
              <Text style={styles.hint}>Closing balance · PDF page {statement.balance.page}{pocket.reportedBalanceCents !== null ? ` · Saved balance ${formatMoney(pocket.reportedBalanceCents)}` : ''}</Text>
              {needsBalanceChoice && <View style={styles.row}>
                <Choice label="Use PDF balance" selected={balanceOverride === true} disabled={busy || !!batchToken && !batchBalanceAllowed(batchToken)} onPress={() => setBalanceOverride(true)} />
                <Choice label="Keep current balance" selected={balanceOverride === false} disabled={busy} onPress={() => setBalanceOverride(false)} />
              </View>}
              <Text style={styles.hint}>{balanceStatus === 'applied' ? 'Account already has this statement’s closing balance.' : balanceStatus === 'invalid' ? 'This balance cannot be applied. Your saved balance will stay as entered.' : balanceStatus === 'older' ? 'This statement is older than your saved balance. Choose whether to replace it.' : balanceOverride === null ? 'Choose a balance option before saving this PDF.' : updateBalance ? 'Your Account balance will be set to the PDF amount.' : 'Your saved Account balance will stay as entered.'}</Text>
              <Text style={styles.hint}>Your money set aside stays the same.</Text>
              <Text style={styles.hint}>A statement shows the balance on its closing date. Later purchases and deposits may have changed it.</Text>
            </> : <Text style={styles.hint}>No clear closing balance was found. Update your balance manually in Account.</Text>}
          </View>}
          {needsAmountDirectionReview(csv,mapping) && <View style={styles.card}><Text style={styles.section}>Confirm amount direction</Text><Text style={styles.hint}>An amount column alone cannot prove whether positive values are deposits or spending. Check your original export. Money spent is:</Text><View style={styles.row}><Choice label="Negative (−); positive means deposit" selected={directionConfirmed && mapping.spendingSign === 'negative'} onPress={() => { setMapping({...mapping,spendingSign:'negative'}); setDirectionConfirmed(true); }} /><Choice label="Positive (+); negative means credit" selected={directionConfirmed && mapping.spendingSign === 'positive'} onPress={() => { setMapping({...mapping,spendingSign:'positive'}); setDirectionConfirmed(true); }} /></View></View>}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: reviewOptions || !!review.error }} disabled={!!review.error} style={styles.optionsToggle} onPress={() => setReviewOptions(!reviewOptions)}><Text style={styles.linkText}>Import options</Text><Text style={styles.linkText}>{reviewOptions || review.error ? '⌄' : '›'}</Text></Pressable>
          {(reviewOptions || !!review.error) && <>
            <View style={styles.card}>
            <Text style={styles.section}>{statement ? 'Account and statement details' : 'Account and CSV columns'}</Text>
            <Text style={styles.label}>Account nickname</Text>
            <TextInput value={account} onChangeText={setAccountDraft} editable={!busy} maxLength={60} style={styles.input} accessibilityLabel="Bank account nickname" placeholder="Main checking" />
            <Text style={styles.hint}>This changes the linked account’s display name. Transaction identity stays the same. CSV must belong to this account.</Text>
            {statement && <>{statement.pageCounts.map((page) => <Text key={page.page} style={styles.hint}>Page {page.page}: {page.spending} spending · {page.credits} credits</Text>)}</>}
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
            {purchaseRows.slice(0, limit).map((row) => <View key={`${row.id}-${row.rowNumber}`} style={styles.transaction}>
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
            <Text style={styles.hint}>Bank history is separate from the purchases selected above. Deposits, transfers and fees won’t trigger a savings rule.{statement ? ' Your balance choice above controls the update.' : ''}</Text>
            <Button label={`${showHistory ? 'Hide' : 'Review'} bank history`} secondary onPress={() => setShowHistory(!showHistory)} />
            {showHistory && <>{historyRows.slice(0, historyLimit).map((row) => <View key={`${row.id}-${row.rowNumber}`} style={styles.historyRow}>
              <View style={styles.rowBetween}><Text style={styles.transactionTitle}>{bankTransactionName(row.title)}</Text><Text style={[styles.amount, row.amountCents > 0 ? styles.credit : styles.debit]}>{row.amountCents > 0 ? '+' : '−'}{formatMoney(Math.abs(row.amountCents))}</Text></View>
              <Text style={styles.hint}>{new Date(row.occurredAt).toLocaleDateString()} · {row.status === 'recorded' ? 'Posting status not supplied' : row.status === 'pending' ? 'Pending' : 'Posted'} · {csv.locations?.[row.rowNumber - 2] ? `PDF page ${csv.locations[row.rowNumber - 2].page}` : `row ${row.rowNumber}`}</Text>
            </View>)}{historyLimit < historyReview.rows.length && <Button label="Show more bank history" secondary onPress={() => setHistoryLimit(historyLimit + 30)} />}</>}
            {historyReview.excluded.length > 0 && <Text style={styles.hint}>{historyReview.excluded.length.toLocaleString()} invalid, non-USD or empty rows won’t be saved to bank history.</Text>}
            {saveHistory && <Text style={styles.body}>{historyPlan.added} new · {historyPlan.updated} updated bank transactions</Text>}
          </View>}
            <View style={styles.card}>
            <Text style={styles.section}>Savings rule</Text>
            {pocket.activeGoal ? <View style={styles.ruleRow}>
              <Check checked={applyRule} label="Apply current goal rule to imported purchases" onPress={() => setApplyRule(!applyRule)} />
              <View style={styles.transactionMain}><Text style={styles.transactionTitle}>Apply my goal’s rule</Text><Text style={styles.hint}>{ruleDescription(pocket.activeGoal.setAsideRule)}</Text></View>
            </View> : <Text style={styles.hint}>Create a goal later to use this spending history for savings suggestions.</Text>}
            <Text style={styles.body}>{formatMoney(plan.savedCents)} will be added to the set-aside estimate{applyRule ? ', capped by your goal and entered balance' : ''}.</Text>
          </View>
          </>}
          <View style={styles.card}>
            {scanned && <><Text style={styles.error}>Scanned statement: compare every direction, date and amount against the original. All available summary totals must reconcile; partial/unavailable/mismatched checks cannot be overridden in this mode.</Text><Choice label={scanReviewed ? '✓ I checked every scanned row against the PDF' : 'I checked every scanned row against the PDF'} selected={scanReviewed} onPress={() => setScanReviewed(!scanReviewed)} /></>}
            <Text style={styles.body}>Your original file will be saved in Imports. Spending helps find subscriptions.</Text>
            {applyRule && <Text style={styles.hint}>{formatMoney(plan.savedCents)} will be added to your set-aside estimate.</Text>}
            <Button label={busy ? 'Saving import…' : 'Save import'} disabled={!canImport || !!review.error || !!accountIdentity.error || statement?.reconciliation?.status === 'mismatch' && !mismatchReviewed || !hydrated || !automationHydrated || busy || !!pendingAutomatic || (needsBalanceChoice && balanceOverride === null)} onPress={() => void importSelected()} />
          </View>
        </>}
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {sourceFile?.kind === 'pdf' && !busy && !csv && <View style={styles.card}><Text style={styles.section}>Scanned statement?</Text><Text style={styles.hint}>Optional on-device OCR for up to 12 pages. It requires row-by-row review and matching summary totals. Downloading the original Citizens PDF is preferable when available.</Text><Button label="Read scanned PDF on device" disabled={!scannedReadingAvailable} onPress={() => { const current = ++request.current; setBusy(true); setError(''); void readScannedStatement(sourceFile.base64).then(result => { if (current !== request.current) return; const parsed = parseCitizensStatement(result.pages); setScanned(true); setScanReviewed(false); setStatement(parsed); setCSV(parsed.csv); setMapping(guessMapping(parsed.csv)); setName(sourceFile.name); setBalanceOverride(null); setAutomaticReview(`Scanned statement · ${result.uncertain} uncertain text areas. Compare every row with the original.`); }).catch(cause => { if (current === request.current) setError(cause.message); }).finally(() => { if (current === request.current) setBusy(false); }); }} />{!scannedReadingAvailable && <Text style={styles.hint}>An updated native app build is required. Manual CSV and original text PDFs remain available.</Text>}</View>}
    </FormScrollView>
    {pdfJob && <PDFStatementReader key={pdfJob.id} base64={pdfJob.base64} dom={{ style: { width: 1, height: 1 }, scrollEnabled: false }} onRead={async (pages) => {
      if (request.current !== pdfJob.id || processedPDF.current === pdfJob.id) return;
      processedPDF.current = pdfJob.id;
      // Parsing is complete: the reader timeout must not cancel a file archive.
      setPDFJob(null);
      try {
        const parsed = parseCitizensStatement(pages);
        setStatement(parsed); setBalanceOverride(null); setCSV(parsed.csv); setMapping(guessMapping(parsed.csv)); setName(pdfJob.name);
        setReviewOptions(false); setLimit(20); setShowExcluded(false); setExcludedLimit(20);
        setDone(null); setError(''); setApplyRule(false); setSelectionOverrides(new Map()); setSaveHistory(true); setShowHistory(false); setHistoryLimit(20); Keyboard.dismiss();
        if (pdfJob.shared && useStatementAutomationStore.getState().enabled) {
          const result = prepareSharedStatement(parsed, account);
          if (result.status === 'review') setAutomaticReview(result.reason);
          else setPendingAutomatic({ id: pdfJob.id, statement: parsed, file: pdfJob.file, accountLabel: result.accountLabel });
        }
      } catch (cause) { if (request.current === pdfJob.id) setError(cause instanceof Error ? cause.message : 'Could not read or save this Citizens statement. Review it and try again.'); }
      finally { if (request.current === pdfJob.id) { setBusy(false); setAutomaticSaving(false); } }
    }} onError={async (message) => { if (request.current === pdfJob.id && processedPDF.current !== pdfJob.id) { setError(message); setPDFJob(null); setBusy(false); } }} />}
    <Modal visible={pendingAutomatic !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { setPendingAutomatic(null); setAutomaticReview('Review this statement before saving.'); }}>
      <View style={styles.scrim}><SafeAreaView style={styles.modal}><ScrollView contentContainerStyle={styles.balanceQuestion}>
        <Text accessibilityRole="header" style={styles.section}>Update your balance?</Text>
        <Text style={styles.body}>Use the PDF’s closing balance for your Account?</Text>
        <Text style={styles.balanceAmount}>{pendingAutomatic?.statement.balance ? formatMoney(pendingAutomatic.statement.balance.amountCents) : ''}</Text>
        <Text style={styles.hint}>{pendingAutomatic?.statement.balance ? `As of ${new Date(`${pendingAutomatic.statement.balance.asOf}T12:00:00`).toLocaleDateString()}` : ''}{pocket.reportedBalanceCents !== null ? ` · Saved balance ${formatMoney(pocket.reportedBalanceCents)}` : ''}</Text>
        <Text style={styles.body}>Either option saves the PDF and imports its transactions. Your money set aside stays the same.</Text>
        <Button label="Use PDF balance" disabled={busy} onPress={() => void saveSharedStatement('statement')} />
        <Button label="Keep current balance" secondary disabled={busy} onPress={() => void saveSharedStatement('current')} />
        <Button label="Review before saving" secondary onPress={() => { setPendingAutomatic(null); setAutomaticReview('Review this statement before saving.'); }} />
      </ScrollView></SafeAreaView></View>
    </Modal>
    <Modal visible={column !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setColumn(null)}>
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

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 36, gap: 16 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800', flexShrink: 1 }, body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, label: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 15, gap: 12 },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ink, padding: 12, borderRadius: 7 },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 13, textAlign: 'center' }, secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, secondaryText: { color: colors.ink }, disabled: { opacity: 0.45 },
  input: { minHeight: 46, padding: 12, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  field: { minHeight: 52, borderColor: colors.line, borderWidth: 1, borderRadius: 7, padding: 10, gap: 4 }, fieldValue: { color: colors.ink, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, padding: 10 }, selected: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceText: { color: colors.ink, fontSize: 12, fontWeight: '700' }, selectedText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  transaction: { flexDirection: 'row', gap: 6, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12 }, transactionMain: { flex: 1, gap: 4 }, transactionTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' }, amount: { color: colors.ink, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }, match: { color: colors.accentDark, fontSize: 12, lineHeight: 18 },
  checkButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, check: { width: 24, height: 24, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }, ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  landing: { gap: 8 }, smallLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 }, linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  optionsToggle: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  historyRow: { gap: 5, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12 },
  credit: { color: colors.primary }, debit: { color: colors.danger }, balanceQuestion: { gap: 14 }, balanceAmount: { color: colors.ink, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 }, scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 }, modal: { maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 12, padding: 15 }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }, option: { minHeight: 48, padding: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
}));
