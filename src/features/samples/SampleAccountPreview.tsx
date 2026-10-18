import { Text, View } from 'react-native';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import { formatMoney } from '@/lib/money';
import { filterTransactions } from '@/features/pocket/transactions';
import { sampleAccount, sampleTransactions } from './fixtures';
import { useSampleDataStore } from './store';

/** Read-only examples never enter account calculations, reconciliation or exports. */
export default function SampleAccountPreview({ full = false, query = '', filter = 'all' }: {
  full?: boolean; query?: string; filter?: 'all' | 'out' | 'in' | 'pending' | 'savings';
}) {
  useThemeRevision();
  const visible = useSampleDataStore(state => state.visible);
  if (!visible) return null;
  const account = sampleAccount();
  const rows = filterTransactions(sampleTransactions(), query, filter);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Sample Citizens account</Text>
    <Text style={styles.note}>Invented examples · separate from your real account</Text>
    <Text accessibilityLabel={`Sample closing balance: ${formatMoney(account.balanceCents)}`} style={styles.balance}>{formatMoney(account.balanceCents)}</Text>
    <Text style={styles.note}>Sample closing balance · September 30, 2026</Text>
    {(full ? rows : rows.slice(0, 3)).map(row => <View key={row.id} style={styles.row}>
      <View style={styles.description}><Text style={styles.name}>{row.title}</Text><Text style={styles.note}>Sample · {row.sourceDate} · posted</Text></View>
      <Text style={styles.amount}>{formatMoney(row.amountCents)}</Text>
    </View>)}
    {!rows.length && <Text style={styles.note}>No sample transactions match this search or filter.</Text>}
    <Text style={styles.note}>Read-only samples are excluded from your balance, savings, reminders and financial exports.</Text>
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, padding: 20, borderRadius: 18, gap: 12, borderWidth: 1, borderColor: colors.line },
  heading: { color: colors.ink, fontWeight: '600', fontSize: 20 }, balance: { color: colors.ink, fontWeight: '600', fontSize: 30, fontVariant: ['tabular-nums'] },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  description: { flexGrow: 1, flexShrink: 1, flexBasis: 160, gap: 4 }, name: { color: colors.ink, fontSize: 15, fontWeight: '500' }, amount: { color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
}));
