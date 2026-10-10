import { useMemo, useState } from 'react';
import { Stack, router } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TransactionRow } from '@/features/pocket/TransactionRow';
import { pocketTransactions } from '@/features/pocket/transactions';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

export default function AccountTransactionsScreen() {
  const { accountTransactions, purchases } = usePocketStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'out' | 'in' | 'pending'>('all');
  const transactions = useMemo(() => pocketTransactions(accountTransactions, purchases), [accountTransactions, purchases]);
  const filtered = useMemo(() => transactions.filter((item) => (!query.trim() || `${item.title} ${item.accountLabel}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filter === 'all' || filter === 'in' && item.amountCents > 0 || filter === 'out' && item.amountCents < 0 || filter === 'pending' && item.status === 'pending')), [transactions, query, filter]);
  const filters = [{ value: 'all', label: 'All' }, { value: 'out', label: 'Money out' }, { value: 'in', label: 'Money in' }, { value: 'pending', label: 'Pending' }] as const;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <Stack.Screen options={{ title: 'Transactions' }} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList data={filtered} keyExtractor={(item) => item.id} initialNumToRender={12} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Transactions</Text><Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.push('/bank-import')}><Text style={styles.link}>Import</Text></Pressable></View>
          <TextInput style={styles.search} placeholder="Search transactions" accessibilityLabel="Search transactions" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
          <View style={styles.filters}>{filters.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} style={[styles.filter, filter === item.value && styles.selected]} onPress={() => setFilter(item.value)}><Text style={[styles.filterLabel, filter === item.value && styles.selectedLabel]}>{item.label}</Text></Pressable>)}</View>
          <Text style={styles.note}>{filtered.length} transaction{filtered.length === 1 ? '' : 's'} · statement imports and logged purchases</Text>
        </View>}
        renderItem={({ item }) => <View style={styles.item}><TransactionRow transaction={item} /></View>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>{transactions.length ? 'No transactions match this search or filter.' : 'Import a statement or log a purchase to start your history.'}</Text>}
      />
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
