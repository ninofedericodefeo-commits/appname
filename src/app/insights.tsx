import { SampleInsightsPreview } from '@/features/samples/SampleActivityPreviews';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { monthlyBudgetPeriod } from '@/features/pocket/dateRanges';
import { colors , useThemeRevision } from '@/theme';
import { rangeCoverage } from '@/features/bank/coverage';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { strToU8 } from 'fflate';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import { exportDataFile } from '@/features/data/fileIO';
import type { ExportLink } from '@/features/data/fileIO';
import { annotateRows, transactionCategories } from '@/features/pocket/repository';
import { pocketTransactions } from '@/features/pocket/transactions';
import { belongsToLinkedAccount, accountBalanceEstimate } from '@/features/pocket/balanceEstimate';
import { spendingSummary, transactionCsv } from '@/features/insights/logic';
import { localDateKey, upcomingCharges } from '@/features/subscriptions/logic';
import { listBankImports } from '@/features/bank/importArchive';
import type { SavedBankImport } from '@/features/bank/archiveLogic';
import { usePocketStore } from '@/stores/pocketStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { parseDollars } from '@/features/pocket/logic';
import { formatMoney as money } from '@/lib/money';
export default function InsightsScreen() {
  useThemeRevision();
  const pocket = usePocketStore(), { budgets, setBudget } = useSettingsStore(), { subscriptions } = useSubscriptionStore();
  const today = localDateKey(new Date()), [from, setFrom] = useState(`${today.slice(0, 7)}-01`), [to, setTo] = useState(today);
  const [budgetOpen,setBudgetOpen] = useState(false);
  const [category, setCategory] = useState('Food'), [budget, setBudgetDraft] = useState(''), [error, setError] = useState(''), [link, setLink] = useState<ExportLink | null>(null), [archives, setArchives] = useState<SavedBankImport[]>([]);
  useEffect(() => { void listBankImports(true).then(setArchives).catch(() => setError('Import coverage could not be read.')); }, []);
  useEffect(() => () => { if (link && Platform.OS === 'web') URL.revokeObjectURL(link.url); }, [link]);
  const rows = useMemo(() => annotateRows(pocketTransactions(pocket.accountTransactions, pocket.purchases, [], [], pocket.transactionDirections), pocket.transactionDetails, pocket.merchantAliases).filter(row => belongsToLinkedAccount(row, pocket.linkedBankAccount)), [pocket]);
  let summary: ReturnType<typeof spendingSummary> | null = null, validation = '';
  try { summary = spendingSummary(rows, from, to); } catch (cause) { validation = (cause as Error).message; }
  const relevant = archives.filter(file => pocket.linkedBankAccount?.aliases.includes(file.accountLabel) || file.accountLabel === pocket.bankImportAccountLabel);
  const budgetPeriod = monthlyBudgetPeriod(from,to);
  const openRows = (filters: { category?: string; merchant?: string } = {}) => router.push({ pathname: '/account-transactions', params: { from, to, evidence: filters.category || filters.merchant ? 'spending' : 'activity', ...filters } });
  const fullyCovered = rangeCoverage(relevant,from,to).complete;
  const bills = upcomingCharges(subscriptions, new Date(), 30), billTotal = bills.reduce((sum, item) => sum + item.subscription.amountCents, 0);
  async function output(csv: boolean) { try { setError(''); if (!summary) return; const text = csv ? transactionCsv(summary.selected) : `Centsward recorded activity ${from} through ${to}\nCoverage: ${fullyCovered ? 'statement periods cover selection' : 'incomplete or unknown'}\nSpending ${money(summary.spendingCents)}\nIncome ${money(summary.incomeCents)}\nRefunds ${money(summary.refundCents)}\nNet transfers ${money(summary.transferCents)}\nNet reversals ${money(summary.reversalCents)}\n\n${Object.entries(summary.categories).map(([name, cents]) => `${name}: ${money(cents)}`).join('\n')}\n\nSample subscriptions excluded. Hidden financial rows included.\n`;
    const result = await exportDataFile(strToU8(text), `GasFinder-${from}-${to}.${csv ? 'csv' : 'txt'}`, csv ? 'text/csv' : 'text/plain'); if (result) setLink(result);
  } catch (cause) { setError((cause as Error).message); } }
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={s.safe}><Stack.Screen options={{ title: 'Insights' }} /><FormScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>Spending insights</Text><Text style={s.note}>Recorded posted/logged activity for this account, including hidden rows. Pending activity and savings assignments are excluded. Correct transfers/refunds in transaction details before relying on classifications.</Text>
    <SampleInsightsPreview />
    <TextInput accessibilityLabel="Insights start date" placeholder="From YYYY-MM-DD" style={s.input} value={from} onChangeText={setFrom} /><TextInput accessibilityLabel="Insights end date" placeholder="Through YYYY-MM-DD" style={s.input} value={to} onChangeText={setTo} />
    {!!validation && <Text style={s.danger}>{validation}</Text>}
    {summary && <><View style={s.card}><Text accessibilityRole="header" style={s.heading}>Recorded activity</Text><Pressable accessibilityRole="button" style={s.choice} onPress={() => openRows()}><Text style={s.choiceText}>View supporting transactions ›</Text></Pressable><Text style={s.body}>Spending {money(summary.spendingCents)}{'\n'}Income {money(summary.incomeCents)}{'\n'}Refunds {money(summary.refundCents)}{'\n'}Net transfers {money(summary.transferCents)}{'\n'}Net reversals {money(summary.reversalCents)}</Text><Text style={s.note}>{fullyCovered ? 'Saved statement periods cover this date range; check reconciliation in Saved imports.' : 'Coverage is incomplete or unknown. These totals may omit activity.'}{'\n'}Last confirmed balance date: {accountBalanceEstimate(pocket).snapshotDay ?? 'none'}.</Text></View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>By category</Text><Text style={s.note}>{budgetPeriod ? `Calendar-month budget period: ${from.slice(0,7)}${to === today ? ' · month to date' : ''}` : 'Custom date range · monthly budget comparisons hidden.'} {fullyCovered ? 'Statement period coverage present.' : 'Incomplete coverage: spending and remaining budgets may be understated.'}</Text>{Object.entries(summary.categories).sort((a,b) => b[1]-a[1]).map(([name,cents]) => <Pressable key={name} accessibilityRole="button" style={s.choice} onPress={() => openRows({ category: name })}><Text style={s.body}>{name}: {money(cents)}{budgetPeriod && budgets[name] ? ` · ${Math.round(cents/budgets[name]*100)}% of ${money(budgets[name])} · ${money(Math.abs(budgets[name]-cents))} ${cents > budgets[name] ? 'over' : 'remaining'}` : ''}</Text><View accessible={false} style={{ height: 8, backgroundColor: colors.line, marginVertical: 8, borderRadius: 4 }}><View style={{ height: 8, width: `${summary.spendingCents ? Math.min(100,cents/summary.spendingCents*100) : 0}%`, backgroundColor: colors.primary, borderRadius: 4 }} /></View></Pressable>)}{!summary.selected.length && <Text style={s.note}>No recorded activity in this range.</Text>}</View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>By merchant</Text>{Object.entries(summary.merchants).sort((a,b) => b[1]-a[1]).map(([name,cents]) => <Pressable key={name} accessibilityRole="button" style={s.choice} onPress={() => openRows({ merchant: name })}><Text style={s.body}>{name}: {money(cents)} ›</Text></Pressable>)}</View>
    <View style={s.row}><Pressable accessibilityRole="button" style={s.choice} onPress={() => void output(true)}><Text style={s.choiceText}>Export transactions CSV</Text></Pressable><Pressable accessibilityRole="button" style={s.choice} onPress={() => void output(false)}><Text style={s.choiceText}>Export summary</Text></Pressable></View></>}
    <View style={s.card}><Pressable accessibilityRole="button" accessibilityState={{expanded:budgetOpen}} style={s.choice} onPress={() => { setBudgetOpen(!budgetOpen); setBudgetDraft(budgets[category] ? (budgets[category]/100).toFixed(2) : ''); }}><Text style={s.choiceText}>Optional monthly budget {budgetOpen ? '⌄' : '›'}</Text></Pressable>{budgetOpen && <><Text style={s.note}>{category}: {budgets[category] ? money(budgets[category]) : 'no budget saved'}</Text><View style={s.row}>{transactionCategories.filter(name => name !== 'Income').map(name => <Pressable key={name} accessibilityRole="button" style={[s.choice, category === name && s.selected]} onPress={() => { setCategory(name); setBudgetDraft(budgets[name] ? (budgets[name]/100).toFixed(2) : ''); }}><Text style={s.choiceText}>{name}</Text></Pressable>)}</View><TextInput accessibilityLabel={`${category} monthly budget`} placeholder="0 removes budget" style={s.input} keyboardType="decimal-pad" value={budget} onChangeText={setBudgetDraft} /><Pressable accessibilityRole="button" style={s.button} onPress={() => { const cents = parseDollars(budget); if (cents === null) setError('Enter a budget in dollars.'); else { setBudget(category, cents); setError(''); } }}><Text style={s.buttonText}>Save {category} budget</Text></Pressable><Text style={s.note}>Planning only. Budgets never move money or alter your available balance.</Text></>}</View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Next 30 days: planned bills</Text><Text style={s.body}>{money(billTotal)} in {bills.length} real subscription renewals</Text><Text style={s.note}>Assumes active subscriptions renew at their saved price/date. Excludes samples. This forecast is displayed separately and is never deducted from Account. Bank activity already affects the actual estimate.</Text></View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Goal contributions</Text><Text style={s.body}>Currently set aside: {money(pocket.reservedCents)}</Text><Text style={s.note}>Set-aside contributions are recorded assignments. Paused or skipped purchases are intentions and are not counted as proven cash saved.</Text></View>
    {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}{Platform.OS === 'web' && link && <a href={link.url} download={link.name}>Download {link.name}</a>}
    <SampleDataControl compact />
  </FormScrollView></SafeAreaView>;
}
