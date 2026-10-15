import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SavedBankImport } from '@/features/bank/archiveLogic';
import { exportBankImports, listBankImports, shareBankImport, updateBankImport, relinkBankImport } from '@/features/bank/importArchive';
import { pickBankFile } from '@/features/bank/pickBankFile';
import { formatMoney } from '@/lib/money';
import { dataStyles as s } from '@/features/data/styles';
import { colors } from '@/theme';

export default function BankImportsScreen() {
  const [entries, setEntries] = useState<SavedBankImport[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [query, setQuery] = useState(''), [trash, setTrash] = useState(false), [sort, setSort] = useState<'recent' | 'name' | 'period'>('recent');
  const [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState(''), [name, setName] = useState('');
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => () => { if (download && Platform.OS === 'web') URL.revokeObjectURL(download.url); }, [download]);
  const refresh = useCallback(async () => { setEntries(await listBankImports(true)); }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    void listBankImports(true).then(items => { if (active) setEntries(items); }).catch(() => { if (active) setError('Could not open saved imports.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  const filtered = useMemo(() => entries.filter(entry => !!entry.trashedAt === trash && `${entry.name} ${entry.accountLabel} ${entry.balanceAsOf ?? ''} ${entry.periods?.join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'period' ? (b.balanceAsOf ?? '').localeCompare(a.balanceAsOf ?? '') : b.lastImportedAt.localeCompare(a.lastImportedAt)), [entries, trash, query, sort]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this saved file.'); } finally { setBusy(false); } }
  function choice(label: string, action: () => void, chosen = false) { return <Pressable key={label} accessibilityRole="button" disabled={busy} accessibilityState={{ selected: chosen, disabled: busy }} style={[s.choice, chosen && s.selected]} onPress={action}><Text style={s.choiceText}>{label}</Text></Pressable>; }
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={s.safe}><FlatList data={filtered} keyExtractor={entry => entry.id} contentContainerStyle={s.content}
    ListHeaderComponent={<View style={{ gap: 12 }}><Text accessibilityRole="header" style={s.title}>Saved imports</Text><Text style={s.note}>Originals live in the app’s Imports folder. Trash hides files from this library and can be undone here. Transactions and duplicate protection remain saved.</Text>
      <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push('/bank-import')}><Text style={s.buttonText}>Import a statement</Text></Pressable>
      <TextInput accessibilityLabel="Search saved imports" placeholder="Search name, account or period" value={query} onChangeText={setQuery} style={s.input} />
      <View style={s.row}>{choice('Files', () => { setTrash(false); setSelected([]); }, !trash)}{choice(`Trash (${entries.filter(item => item.trashedAt).length})`, () => { setTrash(true); setSelected([]); }, trash)}</View>
      <View style={s.row}>{choice('Recent', () => setSort('recent'), sort === 'recent')}{choice('Name', () => setSort('name'), sort === 'name')}{choice('Statement date', () => setSort('period'), sort === 'period')}</View>
      {!!selected.length && <><Text style={s.note}>{selected.length} selected · ZIP exports are not encrypted. Use Backup in Settings for an encrypted copy.</Text>{choice('Export selected originals', () => void run(async () => { const result = await exportBankImports(selected); if (result) setDownload(result); }))}</>}
      {download && Platform.OS === 'web' && <a href={download.url} download={download.name} style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: colors.primary }}>Save {download.name}</a>}
      {(loading || busy) && <ActivityIndicator color={colors.accentDark} />}{!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}
    </View>}
    ListEmptyComponent={!loading ? <Text style={s.note}>{trash ? 'Trash is empty.' : 'No files match. Confirm a PDF or CSV import to save its original here.'}</Text> : null}
    renderItem={({ item }) => <View style={s.card}>
      <View style={s.row}><Pressable accessibilityRole="checkbox" accessibilityLabel={`Select ${item.name}`} accessibilityState={{ checked: selected.includes(item.id) }} aria-checked={selected.includes(item.id)} style={s.choice} onPress={() => setSelected(ids => ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id])}><Text style={s.choiceText}>{selected.includes(item.id) ? '✓ Selected' : 'Select'}</Text></Pressable><Text style={s.note}>{item.kind.toUpperCase()} · {item.accountLabel}</Text></View>
      <Text style={s.heading}>{item.name}</Text><Text style={s.note}>Saved {new Date(item.importedAt).toLocaleDateString()} · {item.transactionCount} transactions{item.sizeBytes !== undefined ? ` · ${(item.sizeBytes / 1024).toFixed(1)} KB` : ''}</Text>
      {!!item.periods?.length && <Text style={s.note}>Period {item.periods.join(', ')}</Text>}
      {item.balanceCents !== undefined && <Text style={s.body}>Closing balance {formatMoney(item.balanceCents)}{item.balanceAsOf ? ` · ${item.balanceAsOf}` : ''}</Text>}
      {item.importReport && <Text style={s.note}>{item.importReport.parser.startsWith('citizens') ? 'Citizens PDF' : 'CSV'} · {item.importReport.checks === 'matched' ? 'Totals match' : item.importReport.checks}{'\n'}{item.importReport.added} added · {item.importReport.matched} matched · {item.importReport.excludedRows} excluded{'\n'}{item.importReport.balanceUpdated ? 'Statement balance accepted' : 'Existing balance kept'} · {formatMoney(item.importReport.savedCents)} set aside</Text>}
      {item.missingOriginal && <Text style={s.danger}>Original is missing. Reselect the same file to restore it without importing transactions again.</Text>}
      {editing === item.id ? <><TextInput accessibilityLabel="Rename saved import" value={name} onChangeText={setName} style={s.input} maxLength={120} /><View style={s.row}>{choice('Save name', () => void run(async () => { await updateBankImport(item.id, { name }); setEditing(''); }))}{choice('Cancel rename', () => setEditing(''))}</View></> : null}
      <View style={s.row}>
        {trash ? choice('Restore file', () => void run(async () => { await updateBankImport(item.id, { trash: false }); })) : <>{!item.missingOriginal && choice('Review again', () => router.push({ pathname: '/bank-import', params: { archiveId: item.id } }))}{choice('Rename', () => { setEditing(item.id); setName(item.name); })}{choice('Move to Trash', () => void run(async () => { await updateBankImport(item.id, { trash: true }); setSelected(ids => ids.filter(id => id !== item.id)); }))}</>}
        {!item.missingOriginal && choice(Platform.OS === 'web' ? 'Download file' : 'Share file', () => void run(async () => { const result = await shareBankImport(item); if (result) setDownload(result); }))}
        {item.missingOriginal && choice('Relink original', () => void run(async () => { const file = await pickBankFile(); if (file) await relinkBankImport(item.id, file); }))}
        {!!item.transactionIds?.length && choice('View transactions', () => router.push({ pathname: '/account-transactions', params: { importId: item.id } }))}
      </View>
    </View>} /></SafeAreaView>;
}
