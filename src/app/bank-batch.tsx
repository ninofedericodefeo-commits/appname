import { useDraftGuard } from '@/components/useDraftGuard';
import { useThemeRevision } from '@/theme';
import { pickStatementFolder } from '@/features/bank/pickStatementFolder';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack, router, useFocusEffect } from 'expo-router';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import { pickBankFiles } from '@/features/bank/pickBankFile';
import { getBatch, startBatch, updateBatch, chooseBatchBalance, clearBatch, batchBalanceAllowed, batchDecisionMade, resumeBatch, batchStorageStatus, subscribeBatchStorage } from '@/features/bank/batch';
import { parseBankCSV, guessMapping, previewAccountTransactions } from '@/features/bank/importLogic';
import { parseCitizensStatement } from '@/features/bank/citizensStatement';
import PDFStatementReader from '@/features/bank/PDFStatementReader';
import { usePocketStore } from '@/stores/pocketStore';
import { resolveLinkedAccount } from '@/features/bank/accountIdentity';
import { formatMoney } from '@/lib/money';
export default function BankBatch() {
  useThemeRevision();
  const [items,setItems] = useState(getBatch), [error,setError] = useState(''), [picking,setPicking] = useState(false), [chosen,setChosen] = useState<string | null>(() => getBatch().find(item => batchBalanceAllowed(item.token))?.token ?? null);
  const draftStatus = useSyncExternalStore(subscribeBatchStorage,batchStorageStatus,() => '');
  const [decided,setDecided] = useState(batchDecisionMade);
  const guard = useDraftGuard(items.map(item => item.token), true, items.some(item => !item.saved));
  useEffect(() => { void resumeBatch().then(rows => { setItems([...rows]); setDecided(batchDecisionMade()); setChosen(rows.find(item => batchBalanceAllowed(item.token))?.token ?? null); }).catch(() => setError('Could not reopen the batch draft. Your saved imports remain available.')); }, []);
  useFocusEffect(useCallback(() => { setItems([...getBatch()]); }, []));
  const pending = items.find(item => item.summary === 'Waiting to read'), pocket = usePocketStore();
  function finish(token: string, change: Parameters<typeof updateBatch>[1]) { updateBatch(token,change); setItems([...getBatch()]); }
  useEffect(() => { if (!pending || pending.file.kind !== 'csv') return; void Promise.resolve().then(() => { try { const csv = parseBankCSV(pending.file.kind === 'csv' ? pending.file.text : ''), result = previewAccountTransactions(csv,guessMapping(csv),pocket.linkedBankAccount ?? pocket.bankImportAccountLabel); finish(pending.token,{ summary: `${result.rows.length} account rows · ${result.excluded.length} excluded; review columns and matches` }); } catch (cause) { finish(pending.token,{ summary: 'Needs column review', error: (cause as Error).message }); } }); }, [pending, pocket.linkedBankAccount, pocket.bankImportAccountLabel]);
  const candidate = items.filter(item => item.balance && !item.error).sort((a,b) => b.balance!.asOf.localeCompare(a.balance!.asOf))[0];
  return <SafeAreaView edges={['left','right','bottom']} style={s.safe}><Stack.Screen options={{ title: 'Import a batch' }} /><FormScrollView contentContainerStyle={s.content}><Text accessibilityRole="header" style={s.title}>Import a batch</Text><Text style={s.note}>Choose up to 12 files. Review and save each file using the normal import screen. Only one chosen PDF may offer a balance replacement. Unfinished files and per-file save status are saved on this device. Resolve the balance choice below before reviewing the first file. Saved files are archived.</Text>
  <Pressable accessibilityRole="button" disabled={picking || !!pending} style={s.button} onPress={() => { setPicking(true); setError(''); void pickBankFiles().then(files => { if (files.length) { guard.confirm(() => { setItems(startBatch(files)); setChosen(null); setDecided(false); }, false, items.some(item => !item.saved)); } }).catch(cause => setError(cause.message)).finally(() => setPicking(false)); }}><Text style={s.buttonText}>Choose PDFs or CSVs</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={picking || !!pending} style={s.choice} onPress={() => { setPicking(true); setError(''); void pickStatementFolder().then(result => { if (result.files.length) { guard.confirm(() => { setItems(startBatch(result.files)); setChosen(null); setDecided(false); }, false, items.some(item => !item.saved)); } setError(`${result.known} already archived files skipped. ${result.files.length} new candidates. No balance is chosen by filename.`); }).catch(cause => setError(cause.message)).finally(() => setPicking(false)); }}><Text style={s.choiceText}>Choose a statement folder</Text></Pressable>
  <Text style={s.note}>Save Citizens downloads in one folder in Files. Folder access is requested each time; GasFinder does not watch folders or download behind bank sign-in. You can open this screen from a Shortcut using gasfinder://bank-batch.</Text>
  {!!candidate && <Text style={s.note}>Newest valid closing date: {candidate.balance!.asOf}. Choose deliberately; filenames do not determine this order.</Text>}
  <Pressable accessibilityRole="button" disabled={items.some(item => item.saved)} style={[s.choice, decided && chosen === null && s.selected]} onPress={() => { chooseBatchBalance(null); setChosen(null); setDecided(true); }}><Text style={s.choiceText}>Keep current balance for the entire batch</Text></Pressable>
  {items.map(item => <View key={item.token} style={s.card}><Text accessibilityRole="header" style={s.heading}>{item.file.name}</Text><Text style={s.note}>{item.saved ? 'Saved after review' : item.summary}</Text>{!!item.error && <Text style={s.danger}>{item.error}</Text>}{item.balance && !item.error && !item.saved && <Pressable accessibilityRole="button" disabled={items.some(item => item.saved)} style={[s.choice, chosen === item.token && s.selected]} onPress={() => { chooseBatchBalance(item.token); setChosen(item.token); setDecided(true); }}><Text style={s.choiceText}>Use {formatMoney(item.balance!.amountCents)} as of {item.balance!.asOf}{candidate && candidate.token !== item.token ? ' · older than the newest PDF' : ''}</Text></Pressable>}{!pending && decided && !item.saved && <Pressable accessibilityRole="button" style={s.choice} onPress={() => router.push({ pathname: '/bank-import', params: { batchToken: item.token } })}><Text style={s.choiceText}>Review this file ›</Text></Pressable>}</View>)}
  {!!items.length && <Text accessibilityLiveRegion="polite" style={s.note}>{decided ? chosen ? 'Balance choice saved. The selected PDF may update your balance after its review.' : 'Balance choice saved: keep your current balance for every file.' : 'Choose Keep current balance or a dated PDF before saving any file.'}</Text>}
  {!!draftStatus && <Text accessibilityLiveRegion="polite" style={s.note}>{draftStatus}</Text>}
  {!pending && !!items.length && <Pressable accessibilityRole="button" style={s.choice} onPress={() => guard.confirm(() => { clearBatch(); setItems([]); setDecided(false); }, false, !!items.length)}><Text style={s.choiceText}>Discard batch drafts</Text></Pressable>}
  <Link href="/bank-imports" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Saved imports ›</Text></Pressable></Link>{!!error && <Text style={s.danger}>{error}</Text>}
  {pending?.file.kind === 'pdf' && <PDFStatementReader key={pending.token} base64={pending.file.base64} onRead={async pages => { try { const statement = parseCitizensStatement(pages); resolveLinkedAccount(pocket,pocket.linkedBankAccount?.nickname ?? pocket.bankImportAccountLabel, statement.accountIdentifier); finish(pending.token, { summary: `${statement.csv.rows.length} rows · totals ${statement.reconciliation?.status ?? 'unverified'}`, balance: statement.balance ?? undefined, accountIdentifier: statement.accountIdentifier }); } catch (cause) { finish(pending.token, { summary: 'Could not read PDF', error: (cause as Error).message }); } }} onError={async message => finish(pending.token,{ summary: 'Could not read PDF', error: message })} />}
{guard.dialog}</FormScrollView></SafeAreaView>;
}
