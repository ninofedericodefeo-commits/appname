import { useEffect, useMemo, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { annotateRows, filterHistory, transactionCategories } from '@/features/pocket/repository';
import { listBankImports } from '@/features/bank/importArchive';
import { dataStyles as ds } from '@/features/data/styles';
import { LogPurchase } from '@/features/pocket/LogPurchase';
import { TransactionRow } from '@/features/pocket/TransactionRow';
import { TransactionRemovalNotice } from '@/features/pocket/TransactionRemovalNotice';
import { useTransactionRemoval } from '@/features/pocket/useTransactionRemoval';
import { filterTransactions, pocketTransactions } from '@/features/pocket/transactions';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';
import { belongsToLinkedAccount } from '@/features/pocket/balanceEstimate';

export default function AccountTransactionsScreen() {
  const { importId } = useLocalSearchParams<{ importId?: string }>();
  const { linkedBankAccount, accountTransactions, purchases, entries, hiddenTransactionIds, transactionDirections, transactionDetails, merchantAliases } = usePocketStore();
  const removal = useTransactionRemoval();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'out' | 'in' | 'pending' | 'savings'>('all');
  const [showLegacyAccounts, setShowLegacyAccounts] = useState(false);
  const [advanced, setAdvanced] = useState(false), [from, setFrom] = useState(''), [to, setTo] = useState(''), [source, setSource] = useState('all'), [category, setCategory] = useState('all'), [categoryPicker, setCategoryPicker] = useState(false);
  const [importRows, setImportRows] = useState<{ id: string; name: string; transactionIds?: string[] }[]>([]), [sourceError, setSourceError] = useState('');
  useEffect(() => { let active = true; void listBankImports(true).then(rows => { if (active) setImportRows(rows); }).catch(() => { if (active) setSourceError('Saved import details could not be read.'); }); return () => { active = false; }; }, []);
  const transactions = useMemo(() => annotateRows(pocketTransactions(accountTransactions, purchases, entries, hiddenTransactionIds, transactionDirections), transactionDetails, merchantAliases), [accountTransactions, purchases, entries, hiddenTransactionIds, transactionDirections, transactionDetails, merchantAliases]);
  const hasOtherAccounts = transactions.some(row => !belongsToLinkedAccount(row, linkedBankAccount));
  const { filtered, filterError } = useMemo(() => {
    try { return { filtered: filterHistory(filterTransactions(showLegacyAccounts ? transactions : transactions.filter(row => belongsToLinkedAccount(row, linkedBankAccount)), query, filter), { from, to, source, category, importIds: importId ? importRows.find(item => item.id === importId)?.transactionIds ?? [] : undefined }), filterError: '' }; }
    catch (error) { return { filtered: [], filterError: error instanceof Error ? error.message : 'Check the history filters.' }; }
  }, [transactions, query, filter, linkedBankAccount, showLegacyAccounts, from, to, source, category, importId, importRows]);
  const filters = [{ value: 'all', label: 'All' }, { value: 'out', label: 'Money out' }, { value: 'in', label: 'Money in' }, { value: 'pending', label: 'Pending' }, { value: 'savings', label: 'Savings' }] as const;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <Stack.Screen options={{ title: 'Transactions' }} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList data={filtered} keyExtractor={(item) => item.id} initialNumToRender={12} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Transactions</Text><Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.push('/bank-import')}><Text style={styles.link}>Import</Text></Pressable></View>
          <LogPurchase />
          <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.push('/account-review')}><Text style={styles.link}>Review matches & hidden history ›</Text></Pressable>
          {linkedBankAccount && <Text style={styles.note}>{showLegacyAccounts ? 'All saved account histories' : linkedBankAccount.nickname}</Text>}
          {hasOtherAccounts && <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => setShowLegacyAccounts(!showLegacyAccounts)}><Text style={styles.link}>{showLegacyAccounts ? 'Show linked account only' : 'Show older account histories'}</Text></Pressable>}
          <TextInput style={styles.search} placeholder="Search transactions" accessibilityLabel="Search transactions" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
          <View style={styles.filters}>{filters.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} style={[styles.filter, filter === item.value && styles.selected]} onPress={() => setFilter(item.value)}><Text style={[styles.filterLabel, filter === item.value && styles.selectedLabel]}>{item.label}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }} style={styles.linkButton} onPress={() => setAdvanced(!advanced)}><Text style={styles.link}>{advanced ? 'Hide filters' : 'Date, category & source filters'}</Text></Pressable>
          {advanced && <View style={ds.card}><TextInput accessibilityLabel="History start date" placeholder="From · YYYY-MM-DD" value={from} onChangeText={setFrom} style={ds.input} /><TextInput accessibilityLabel="History end date" placeholder="Through · YYYY-MM-DD" value={to} onChangeText={setTo} style={ds.input} /><Text style={ds.note}>Source</Text><View style={ds.row}>{['all', 'citizens-pdf', 'csv', 'manual', 'shortcut', 'savings'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: source === value }} style={[ds.choice, source === value && ds.selected]} onPress={() => setSource(value)}><Text style={ds.choiceText}>{value === 'citizens-pdf' ? 'Citizens PDF' : value}</Text></Pressable>)}</View><Pressable accessibilityRole="button" style={ds.choice} onPress={() => setCategoryPicker(!categoryPicker)}><Text style={ds.choiceText}>Category: {category}</Text></Pressable>{categoryPicker && <View style={ds.row}>{['all', ...transactionCategories].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} style={[ds.choice, category === value && ds.selected]} onPress={() => { setCategory(value); setCategoryPicker(false); }}><Text style={ds.choiceText}>{value}</Text></Pressable>)}</View>}{importId && <><Text style={ds.note}>File: {importRows.find(item => item.id === importId)?.name ?? 'Loading source…'}</Text><Pressable accessibilityRole="button" style={ds.choice} onPress={() => router.setParams({ importId: undefined })}><Text style={ds.choiceText}>Show all source files</Text></Pressable></>}<Pressable accessibilityRole="button" style={ds.choice} onPress={() => { setFrom(''); setTo(''); setSource('all'); setCategory('all'); setQuery(''); setFilter('all'); }}><Text style={ds.choiceText}>Clear filters</Text></Pressable></View>}
          {!!(filterError || sourceError) && <Text accessibilityRole="alert" style={ds.danger}>{filterError || sourceError}</Text>}
          {importId && !advanced && <View><Text style={ds.note}>File: {importRows.find(item => item.id === importId)?.name ?? 'Loading source…'}</Text><Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.setParams({ importId: undefined })}><Text style={styles.link}>Show all source files</Text></Pressable></View>}
          <Text style={styles.note}>{filtered.length} transaction{filtered.length === 1 ? '' : 's'} · bank history, purchases and savings</Text>
        </View>}
        renderItem={({ item }) => <View style={styles.item}><TransactionRow transaction={item} onRemove={removal.remove} /></View>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>{transactions.length ? 'No transactions match this search or filter.' : 'Import a statement or log a purchase to start your history.'}</Text>}
      />
      {removal.hasRemoved && <TransactionRemovalNotice onUndo={removal.undo} />}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, fill: { flex: 1 }, content: { padding: 20, paddingBottom: 40 }, header: { gap: 13, marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { color: colors.ink, fontWeight: '800', fontSize: 28, letterSpacing: -0.8 },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, link: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  search: { minHeight: 46, borderColor: colors.lineStrong, borderWidth: 1, backgroundColor: colors.surface, borderRadius: 9, padding: 12, color: colors.ink, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, filter: { minHeight: 44, justifyContent: 'center', borderColor: colors.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }, selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { color: colors.ink, fontWeight: '700', fontSize: 12 }, selectedLabel: { color: colors.surface }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  item: { backgroundColor: colors.surface, paddingHorizontal: 14 }, separator: { borderBottomColor: colors.line, borderBottomWidth: 1 }, empty: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 25 },
});
