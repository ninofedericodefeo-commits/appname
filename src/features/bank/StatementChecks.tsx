import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { formatMoney } from '@/lib/money';
import type { StatementReconciliation } from './statementReconciliation';

export default function StatementChecks({ value }: { value: StatementReconciliation }) {
  const title = value.status === 'matched' ? 'Statement totals match' : value.status === 'mismatch' ? 'Statement totals need review' : value.status === 'partial' ? 'Available totals match' : 'Statement totals could not be checked';
  return <View style={[styles.card, value.status === 'mismatch' && styles.warning, value.status === 'unavailable' && styles.unverified]}>
    <Text style={styles.heading}>{title}</Text>
    <Text style={styles.body}>Read {formatMoney(value.debitCents)} spending · {formatMoney(value.creditCents)} deposits</Text>
    {value.status === 'partial' && <Text style={styles.note}>Some summary fields were missing. Compare the imported rows with your PDF.</Text>}
    {value.status === 'unavailable' && <Text style={styles.note}>This PDF does not provide readable totals for a completeness check.</Text>}
    {value.checks.map((check, index) => <View key={index} style={styles.row}><Text style={styles.body}>{check.label}{value.checks.length > 3 ? ` · p${check.page}` : ''}</Text><Text style={[styles.result, !check.matched && styles.error]}>{check.matched ? 'Matches ✓' : `PDF ${formatMoney(check.expectedCents)} · read ${formatMoney(check.readCents)}`}</Text></View>)}
    {value.status === 'mismatch' && <Text style={styles.error}>Spending or deposits may be missing or read incorrectly. Check the original before saving.</Text>}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, gap: 10, backgroundColor: colors.paleGreen, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, warning: { backgroundColor: colors.paleOrange, borderColor: colors.accent },
  unverified: { backgroundColor: colors.surface },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '800' }, body: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { gap: 2, borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 }, result: { color: colors.primary, fontSize: 12, fontWeight: '700' }, error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
