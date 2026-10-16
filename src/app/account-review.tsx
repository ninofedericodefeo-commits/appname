import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import { effectiveBankTransaction, pocketTransactions, transactionDisplayName } from '@/features/pocket/transactions';
import { annotateRows } from '@/features/pocket/repository';
import { bankDuplicateCandidates, matchCandidates, separationStillApplies, isCurrentReviewRevision } from '@/features/pocket/reconciliation';
import { belongsToLinkedAccount } from '@/features/pocket/balanceEstimate';
import { usePocketStore } from '@/stores/pocketStore';
import { recoverableBankOperation } from '@/features/data/backupService';
import { formatMoney as money } from '@/lib/money';

const pageSize = 25;
const firstPages = { app: 0, bank: 0, links: 0, duplicates: 0, hidden: 0, separate: 0 };
type Section = keyof typeof firstPages;
function Pager({ label, page, shown, more, onPage }: { label: string; page: number; shown: number; more: boolean; onPage: (page: number) => void }) {
  if (!page && !more) return null;
  return <View style={{ gap: 8 }}>
    <Text style={s.note}>{label}: {shown ? `${page * pageSize + 1}–${page * pageSize + shown}` : 'No results on this page'}{more ? ' · more available' : ''}</Text>
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${label} page`} disabled={!page} style={[s.choice, !page && s.disabled]} onPress={() => onPage(page - 1)}><Text style={s.choiceText}>Previous</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next ${label} page`} disabled={!more} style={[s.choice, !more && s.disabled]} onPress={() => onPage(page + 1)}><Text style={s.choiceText}>Next</Text></Pressable>
    </View>
  </View>;
}

export default function AccountReview() {
  const state = usePocketStore();
  const [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [query, setQuery] = useState(''), [pages, setPages] = useState(firstPages);
  const rows = annotateRows(pocketTransactions(state.accountTransactions, state.purchases, state.entries, [], state.transactionDirections), state.transactionDetails, state.merchantAliases)
    .filter(row => belongsToLinkedAccount(row, state.linkedBankAccount));
  const rowById = new Map(rows.map(row => [row.id,row])), bankById = new Map(state.accountTransactions.map(row => [row.id,effectiveBankTransaction(row,state.transactionDirections)]));
  const purchaseById = new Map(state.purchases.map(purchase => [purchase.id,purchase]));
  function bankName(id: string) { const row = rowById.get(id) ?? bankById.get(id); return row ? transactionDisplayName(row) : 'Earlier bank record'; }
  function bankSummary(id: string) { const row = rowById.get(id) ?? bankById.get(id); return row ? `${bankName(id)} · ${money(row.amountCents)} · ${row.sourceDate ?? row.occurredAt.slice(0,10)}` : 'Earlier bank record'; }
  const search = query.trim().toLowerCase();
  function contains(text: string) { return search.split(/\s+/).every(term => text.toLowerCase().includes(term)); }
  const hidden = new Set(state.hiddenTransactionIds);
  const hiddenRows = rows.filter(row => (hidden.has(row.id) || hidden.has(row.linkedPurchaseId ?? row.purchase?.id ?? '')) && contains(`${transactionDisplayName(row)} ${row.title} ${row.sourceDate ?? row.occurredAt} ${money(row.amountCents)}`));
  const options = { directions: state.transactionDirections, separateDecisions: state.separatePurchaseDecisions, limit: pageSize + 1, query };
  const matches = matchCandidates(state.accountTransactions, state.purchases, state.linkedBankAccount, { ...options, offset: pages.app * pageSize });
  const bankPairs = bankDuplicateCandidates(state.accountTransactions, state.linkedBankAccount, { ...options, offset: pages.bank * pageSize });
  const linkHistory = state.matchHistory.slice().reverse().filter(item => contains(`${bankSummary(item.bankId)} ${purchaseById.get(item.purchaseId)?.title ?? ''} ${item.createdAt}`));
  const duplicateHistory = state.bankDuplicateHistory.slice().reverse().filter(item => contains(`${bankSummary(item.bankId)} ${bankSummary(item.canonicalId)} ${item.createdAt}`));
  const separateHistory = state.separatePurchaseDecisions.slice().reverse().filter(item => contains(`${bankSummary(item.bankId)} ${item.kind === 'bank-bank' ? bankSummary(item.otherId) : purchaseById.get(item.otherId)?.title ?? 'Earlier purchase'} ${item.createdAt}`));
  function page<T>(items: T[], section: Section) { return items.slice(pages[section] * pageSize, (pages[section] + 1) * pageSize); }
  function pager(section: Section, label: string, shown: number, more: boolean) {
    return <Pager label={label} page={pages[section]} shown={shown} more={more} onPage={next => { setPages(current => ({ ...current, [section]: next })); setConfirm(''); }} />;
  }
  function historyPager(section: Section, label: string, length: number) {
    return pager(section, label, Math.max(0, Math.min(pageSize, length - pages[section] * pageSize)), length > (pages[section] + 1) * pageSize);
  }
  async function run(action: () => void, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await recoverableBankOperation(async permit => { permit(action); }); setConfirm(''); setPages(firstPages); setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this review.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView edges={['left','right','bottom']} style={s.safe}>
    <Stack.Screen options={{ title: 'Account review' }} />
    <FormScrollView contentContainerStyle={s.content}>
      <Text accessibilityRole="header" style={s.title}>Account review</Text>
      <TextInput accessibilityLabel="Search transaction reviews and hidden history" placeholder="Search merchant, date or amount" value={query} editable={!busy} onChangeText={value => { setQuery(value); setPages(firstPages); setConfirm(''); }} style={s.input} />
      {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Possible app-to-bank matches</Text>
        <Text style={s.note}>Same amount within seven days is only a suggestion. Check the original statement. Linking counts one financial movement; it adds no goal contribution. Existing set-asides stay assigned.</Text>
        {matches.slice(0,pageSize).map(({ row, purchase }) => {
          const key = `${row.id}:${purchase.id}`;
          return <View key={key} style={s.card}>
            <Text style={s.body}>{bankSummary(row.id)}{'\n'}App: {purchase.title} · {money(-purchase.amountCents)} · {purchase.purchasedAt.slice(0,10)}</Text>
            {row.directionCorrected && <Text style={s.note}>Uses your corrected withdrawal direction.</Text>}
            <Pressable disabled={busy} accessibilityRole="button" style={s.choice} onPress={() => setConfirm(confirm === key ? '' : key)}><Text style={s.choiceText}>Review link</Text></Pressable>
            <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Keep ${bankName(row.id)} and ${purchase.title} as different purchases`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().keepPurchasesSeparate('bank-purchase',row.id,purchase.id), 'Kept as different purchases. Both still count.')}><Text style={s.choiceText}>Different purchases — keep separate</Text></Pressable>
            {confirm === key && <><Text style={s.danger}>Confirm these describe one purchase?</Text><Pressable disabled={busy} accessibilityRole="button" style={s.button} onPress={() => void run(() => usePocketStore.getState().linkExistingPurchase(row.id,purchase.id), 'Linked as one purchase. Undo is available in Link history.')}><Text style={s.buttonText}>Link as one purchase</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" style={s.choice} onPress={() => setConfirm('')}><Text style={s.choiceText}>Not sure — review later</Text></Pressable></>}
          </View>;
        })}
        {!matches.length && <Text style={s.note}>No matching candidates on this page.</Text>}
        {pager('app','app-to-bank matches',Math.min(matches.length,pageSize),matches.length > pageSize)}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Similar bank rows</Text>
        <Text style={s.note}>Equal charges can be real separate purchases. Keep both unless the statement confirms one movement. A reviewed duplicate is excluded from estimates, insights and subscription evidence. Raw records and set-aside contributions remain; adjust any earlier duplicate savings separately.</Text>
        {bankPairs.slice(0,pageSize).map(({ row, canonical }) => {
          const key = `bank:${row.id}:${canonical.id}`;
          return <View key={key} style={s.card}>
            <Text style={s.body}>{bankSummary(row.id)} · {row.status}{'\n'}Other: {bankSummary(canonical.id)} · {canonical.status}</Text>
            {(row.directionCorrected || canonical.directionCorrected) && <Text style={s.note}>Uses corrected transaction directions.</Text>}
            <Pressable disabled={busy} accessibilityRole="button" style={s.choice} onPress={() => setConfirm(confirm === key ? '' : key)}><Text style={s.choiceText}>Review as one bank movement</Text></Pressable>
            <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Keep both ${bankName(row.id)} purchases`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().keepPurchasesSeparate('bank-bank',row.id,canonical.id), 'Kept both purchases. This pair will stay out of review unless its evidence changes.')}><Text style={s.choiceText}>Keep both purchases</Text></Pressable>
            {confirm === key && <><Text style={s.danger}>Exclude the first row as a duplicate of the other?</Text><Pressable disabled={busy} accessibilityRole="button" style={s.button} onPress={() => void run(() => usePocketStore.getState().markBankDuplicate(row.id,canonical.id), 'Confirmed one movement. Undo is available in Duplicate decisions.')}><Text style={s.buttonText}>Confirm one movement</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" style={s.choice} onPress={() => setConfirm('')}><Text style={s.choiceText}>Not sure — review later</Text></Pressable></>}
          </View>;
        })}
        {!bankPairs.length && <Text style={s.note}>No similar bank pairs on this page.</Text>}
        {pager('bank','similar bank rows',Math.min(bankPairs.length,pageSize),bankPairs.length > pageSize)}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Kept separate ({separateHistory.length})</Text>
        <Text style={s.note}>These decisions preserve both purchases. Changed amount, direction, date or account evidence can bring a pair back for review.</Text>
        {page(separateHistory,'separate').map(item => {
          const applies = separationStillApplies(item,state.accountTransactions,state.purchases,state.transactionDirections);
          return <View key={item.id} style={{ gap: 8 }}>
            <Text style={s.body}>{bankSummary(item.bankId)}{'\n'}Other: {item.kind === 'bank-bank' ? bankSummary(item.otherId) : purchaseById.get(item.otherId)?.title ?? 'Earlier purchase'}</Text>
            <Text style={s.note}>{new Date(item.createdAt).toLocaleString()} · {item.undoneAt ? 'Undone' : applies ? 'Kept separate' : 'Evidence changed or record no longer available'}</Text>
            {!item.undoneAt && <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Undo separate-purchase decision for ${bankName(item.bankId)}`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().undoSeparatePurchases(item.id), 'Separate-purchase decision undone. Eligible pairs can be reviewed again.')}><Text style={s.choiceText}>Undo keep separate</Text></Pressable>}
          </View>;
        })}
        {historyPager('separate','separate-purchase decisions',separateHistory.length)}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Duplicate decisions ({duplicateHistory.length})</Text>
        {page(duplicateHistory,'duplicates').map(item => {
          const applied = isCurrentReviewRevision(state.bankDuplicateHistory,item) && bankById.get(item.bankId)?.duplicateOf === item.canonicalId;
          return <View key={item.id} style={{ gap: 8 }}><Text style={s.body}>{bankSummary(item.bankId)}{'\n'}Other: {bankSummary(item.canonicalId)}</Text><Text style={s.note}>{new Date(item.createdAt).toLocaleString()} · {item.undoneAt ? 'Undone' : applied ? 'Reviewed as one movement' : 'Not the current duplicate decision'}</Text>{!item.undoneAt && applied && <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Undo duplicate decision for ${bankName(item.bankId)}`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().undoBankDuplicate(item.id), 'Duplicate decision undone. Both bank rows count again.')}><Text style={s.choiceText}>Undo duplicate decision</Text></Pressable>}</View>;
        })}
        {historyPager('duplicates','duplicate decisions',duplicateHistory.length)}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Link history ({linkHistory.length})</Text>
        {page(linkHistory,'links').map(item => {
          const applied = isCurrentReviewRevision(state.matchHistory,item) && bankById.get(item.bankId)?.linkedPurchaseId === item.purchaseId;
          return <View key={item.id} style={{ gap: 8 }}><Text style={s.body}>{bankSummary(item.bankId)}{'\n'}App: {purchaseById.get(item.purchaseId)?.title ?? 'Earlier purchase'}</Text><Text style={s.note}>{new Date(item.createdAt).toLocaleString()} · {item.undoneAt ? 'Undone' : applied ? 'Linked' : 'Not the current link'}</Text>{!item.undoneAt && applied && <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Undo link for ${bankName(item.bankId)}`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().undoPurchaseLink(item.id), 'Purchase link undone.')}><Text style={s.choiceText}>Undo link</Text></Pressable>}</View>;
        })}
        {historyPager('links','purchase links',linkHistory.length)}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Hidden history ({hiddenRows.length})</Text>
        <Text style={s.note}>Hidden rows still affect balances, matching and subscription evidence.</Text>
        {page(hiddenRows,'hidden').map(row => <View key={row.id} style={{ gap: 8 }}><Text style={s.body}>{bankSummary(row.id)}</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Show ${transactionDisplayName(row)} in history`} style={s.choice} onPress={() => void run(() => usePocketStore.getState().restoreTransactionsToHistory([row.id,row.linkedPurchaseId ?? row.purchase?.id ?? '']), 'Transaction shown in history.')}><Text style={s.choiceText}>Show in history</Text></Pressable></View>)}
        {historyPager('hidden','hidden transactions',hiddenRows.length)}
      </View>
    </FormScrollView>
  </SafeAreaView>;
}
