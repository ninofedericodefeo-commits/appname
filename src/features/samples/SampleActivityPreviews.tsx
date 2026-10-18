import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import { formatMoney } from '@/lib/money';
import { useSampleDataStore } from './store';
import { sampleCars, sampleFillups, sampleFuelStatistics, samplePastGoals, sampleSpendingSummary } from './activityFixtures';

function SampleSection({ title, children }: { title: string; children: ReactNode }) {
  useThemeRevision();
  const visible = useSampleDataStore(state => state.visible);
  if (!visible) return null;
  return <View style={styles.card}><Text style={styles.badge}>SAMPLE · PREVIEW ONLY</Text><Text accessibilityRole="header" style={styles.heading}>{title}</Text>{children}</View>;
}
function DetailLink({ id, label }: { id: string; label: string }) {
  return <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push({ pathname: '/sample-activity', params: { id } })}><Text style={styles.link}>{label} ›</Text></Pressable>;
}
export function SampleCarsPreview() {
  return <SampleSection title="Sample garage">{sampleCars().map(car => <View key={car.id} style={styles.group}><Text style={styles.name}>{car.name}</Text><Text style={styles.note}>{car.model} · {car.mpg} MPG estimate · {car.tankGallons} gal tank</Text><Text style={styles.note}>Example only. Your selected car and trip range stay unchanged.</Text><DetailLink id="sample-car-corolla" label="View sample driving history" /></View>)}</SampleSection>;
}
export function SampleFillupsPreview({ query = '' }: { query?: string }) {
  const fills = sampleFillups().filter(fill => `${fill.stationName} ${fill.stationAddress}`.toLowerCase().includes(query.toLowerCase()));
  if (!fills.length) return null;
  return <SampleSection title="Sample refills & receipts"><Text style={styles.note}>Fictional reports, kept separate from your saved reports and Account spending.</Text>{fills.map(fill => <View key={fill.id} style={styles.group}><Text style={styles.name}>{fill.stationName} · {formatMoney(fill.totalCents!)}</Text><Text style={styles.note}>{fill.observedAt.slice(0, 10)} · {fill.gallons} gal · ${fill.price.toFixed(3)}/gal</Text><DetailLink id={fill.id} label={`View sample receipt · ${fill.observedAt.slice(5, 10)}`} /></View>)}</SampleSection>;
}
export function SampleFuelStatisticsPreview() {
  const stats = sampleFuelStatistics();
  return <SampleSection title="Sample fuel costs"><Text style={styles.amount}>{formatMoney(stats.spentCents)}</Text><Text style={styles.note}>{stats.fillCount} sample refills · {stats.gallons.toFixed(1)} gal · ${stats.weightedUnitPrice!.toFixed(3)}/gal</Text><Text style={styles.note}>{stats.measuredMpg!.toFixed(1)} measured MPG across {stats.measuredMiles} example miles. Calculated from the sample fill-ups only.</Text></SampleSection>;
}
export function SampleInsightsPreview() {
  const summary = sampleSpendingSummary();
  return <SampleSection title="Sample spending insights"><Text style={styles.note}>September 2026 · synthetic Citizens statement only. Independent of your filters, budgets and exports.</Text><Text style={styles.amount}>{formatMoney(summary.spendingCents)} spent</Text>{Object.entries(summary.categories).map(([category, cents]) => <View key={category} style={styles.row}><Text style={styles.note}>{category}</Text><Text style={styles.name}>{formatMoney(cents)}</Text></View>)}<DetailLink id="sample-spending" label="View sample supporting transactions" /></SampleSection>;
}
export function SamplePastGoalsPreview() {
  return <SampleSection title="Sample past goal">{samplePastGoals().map(goal => <View key={goal.id} style={styles.group}><Text style={styles.name}>{goal.title}</Text><Text style={styles.note}>Reached September 15, 2026 · {formatMoney(goal.savedCents)} of {formatMoney(goal.targetCents)}</Text><Text style={styles.note}>Invented achievement. No money was moved or set aside.</Text></View>)}</SampleSection>;
}
export function SampleReceiptPreview({ id }: { id: string }) {
  const fill = sampleFillups().find(item => item.id === id);
  if (!fill) return null;
  return <SampleSection title="Sample fuel receipt"><Text style={styles.name}>{fill.stationName}</Text><Text style={styles.note}>{fill.stationAddress}{'\n'}{fill.observedAt.slice(0, 10)} · Regular · Card price</Text><View style={styles.receipt}><Text style={styles.note}>SYNTHETIC RECEIPT · NOT A REAL PURCHASE</Text><Text style={styles.name}>{fill.gallons!.toFixed(3)} US gal × ${fill.price.toFixed(3)}</Text><Text style={styles.amount}>Total {formatMoney(fill.totalCents!)}</Text><Text style={styles.note}>Includes normal cent rounding. No payment or account details.</Text></View><Text style={styles.note}>Sample daily driver · {fill.odometerMiles!.toLocaleString()} mi · Full tank. Read-only example; excluded from saved reports, bank matching and exports.</Text></SampleSection>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  badge: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: '600' },
  name: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600', flexShrink: 1 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 }, group: { gap: 6 },
  amount: { color: colors.ink, fontSize: 26, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  button: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.primary, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  receipt: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: 10, padding: 16, gap: 14 },
}));
