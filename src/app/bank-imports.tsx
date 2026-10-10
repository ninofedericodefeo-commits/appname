import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SavedBankImport } from '@/features/bank/archiveLogic';
import { listBankImports, shareBankImport } from '@/features/bank/importArchive';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme';

export default function BankImportsScreen() {
  const [entries, setEntries] = useState<SavedBankImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState<string | null>(null);
  const [download, setDownload] = useState<{ id: string; url: string; name: string } | null>(null);
  useEffect(() => () => { if (download && Platform.OS === 'web') URL.revokeObjectURL(download.url); }, [download]);
  const refresh = useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    void listBankImports().then((items) => { if (active) setEntries(items); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not open saved imports.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useFocusEffect(refresh);
  async function share(entry: SavedBankImport) {
    setSharing(entry.id); setError('');
    try { const result = await shareBankImport(entry); if (result) setDownload({ id: entry.id, ...result }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not share this file.'); }
    finally { setSharing(null); }
  }
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FlatList data={entries} keyExtractor={(entry) => entry.id} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.header}>
        <Text style={styles.kicker}>ACCOUNT FILES</Text><Text accessibilityRole="header" style={styles.title}>Imports</Text>
        <Text style={styles.body}>Your confirmed PDFs and CSVs are saved here automatically.</Text>
        <View style={styles.folder}><Text style={styles.folderTitle}>Imports folder</Text><Text style={styles.hint}>{Platform.OS === 'web' ? 'Saved in this browser. Download a copy to keep it in Files.' : 'Created automatically in GasFinder’s documents on this device. Share a copy to save it elsewhere.'}</Text></View>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/bank-import')}><Text style={styles.buttonText}>Import a statement</Text></Pressable>
        {loading && <ActivityIndicator color={colors.accentDark} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>}
      ListEmptyComponent={!loading && !error ? <View style={styles.card}><Text style={styles.name}>No saved files yet</Text><Text style={styles.body}>The next file you confirm will be saved in Imports. You can add previous statements again; transactions already imported won’t be added twice.</Text></View> : null}
      renderItem={({ item }) => <View style={styles.card}>
        <Text style={styles.fileType}>{item.kind.toUpperCase()} · {item.accountLabel || 'Account'}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.hint}>Saved {new Date(item.importedAt).toLocaleDateString()} · {item.transactionCount} readable transactions</Text>
        {item.balanceCents !== undefined && <Text style={styles.body}>Closing balance {formatMoney(item.balanceCents)}{item.balanceAsOf ? ` · ${new Date(`${item.balanceAsOf}T12:00:00`).toLocaleDateString()}` : ''}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push({ pathname: '/bank-import', params: { archiveId: item.id } })}><Text style={styles.secondaryText}>Review again</Text></Pressable>
          {Platform.OS === 'web' && download?.id === item.id ? <a href={download.url} download={download.name} style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 12px', border: `1px solid ${colors.line}`, borderRadius: 7, color: colors.ink, fontSize: 13, fontWeight: 800 }}>Save file</a> : <Pressable accessibilityRole="button" disabled={sharing !== null} style={styles.secondary} onPress={() => void share(item)}><Text style={styles.secondaryText}>{sharing === item.id ? 'Opening…' : Platform.OS === 'web' ? 'Download file' : 'Share file'}</Text></Pressable>}
        </View>
      </View>} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 40, gap: 14 }, header: { gap: 13 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 34, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  folder: { padding: 15, gap: 5, borderRadius: 9, backgroundColor: colors.paleGreen }, folderTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  card: { padding: 16, gap: 10, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12 },
  fileType: { color: colors.accentDark, fontSize: 11, fontWeight: '800' }, name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' }, button: { minHeight: 46, padding: 12, borderRadius: 7, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.surface, fontSize: 13, fontWeight: '800' }, secondary: { minHeight: 44, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  secondaryText: { color: colors.ink, fontSize: 13, fontWeight: '800' }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
