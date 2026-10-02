import { colors } from '@/theme';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { fetchPriceHistory, type HistoryRange } from '@/features/stations/history';
import { formatFuelPrice } from '@/features/stations/logic';
import type { FuelType } from '@/types/stations';

const ranges: { value: HistoryRange; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 'all', label: 'All time' },
];
const validFuels: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];

export default function PriceHistoryScreen() {
  const params = useLocalSearchParams<{ stationId?: string; stationName?: string; fuelType?: string }>();
  const stationId = typeof params.stationId === 'string' ? params.stationId : '';
  const stationName = typeof params.stationName === 'string' ? params.stationName : 'Station';
  const fuelType: FuelType = validFuels.includes(params.fuelType as FuelType) ? params.fuelType as FuelType : 'regular';
  const [range, setRange] = useState<HistoryRange>(30);
  const [now] = useState(() => Date.now());
  const { data: reports = [], isPending, isError, error, refetch } = useQuery({
    queryKey: ['price-history', stationId, fuelType, range],
    enabled: !!stationId,
    queryFn: ({ signal }) => fetchPriceHistory(stationId, fuelType, range, signal),
    staleTime: 15_000,
  });
  const latest = reports.at(-1);
  const first = reports[0];
  const difference = latest && first ? latest.price - first.price : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>FUEL  /  PRICE HISTORY</Text>
          <Link href="/" asChild><Pressable accessibilityRole="button" style={styles.back}><Text style={styles.backText}>Gas prices</Text></Pressable></Link>
        </View>
        <Text style={styles.title}>{stationName}</Text>
        <Text style={styles.subtitle}>{fuelType} · USD per gallon</Text>
        <View style={styles.ranges}>
          {ranges.map((option) => <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: range === option.value }} onPress={() => setRange(option.value)} style={[styles.range, range === option.value && styles.rangeActive]}><Text style={[styles.rangeText, range === option.value && styles.rangeTextActive]}>{option.label}</Text></Pressable>)}
        </View>
        {isPending ? <View style={styles.status}><ActivityIndicator color={colors.accentDark} /><Text style={styles.statusText}>Loading reports…</Text></View> : isError ? (
          <View style={styles.status}><Text style={styles.statusText}>{error instanceof Error ? error.message : 'Could not load history.'}</Text><Pressable accessibilityRole="button" onPress={() => void refetch()}><Text style={styles.retry}>Try again</Text></Pressable></View>
        ) : reports.length === 0 ? (
          <View style={styles.status}><Text style={styles.emptyTitle}>No reports in this range</Text><Text style={styles.statusText}>The graph starts when someone saves a price for this station and fuel. Fictional sample prices are excluded.</Text></View>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>LATEST REPORT</Text>
              <Text style={styles.summaryPrice}>{formatFuelPrice(latest!.price)}<Text style={styles.perGallon}> / gal</Text></Text>
              <Text style={styles.summaryMeta}>{reports.length} report{reports.length === 1 ? '' : 's'} · {reports.length > 1 ? `${difference >= 0 ? '+' : '-'}${formatFuelPrice(Math.abs(difference))} since first report` : 'First report in this range'}</Text>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Reported prices</Text>
              <PriceHistoryChart reports={reports} range={range} now={now} />
              <Text style={styles.footnote}>Each point is one saved, unverified price report. A gap means no reports were saved.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  back: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  backText: { color: colors.surface, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', marginTop: 20 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 24, marginBottom: 19 },
  range: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 11 },
  rangeActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  rangeText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  rangeTextActive: { color: colors.surface },
  status: { backgroundColor: colors.surface, borderRadius: 9, padding: 22, alignItems: 'center', gap: 12 },
  statusText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 20 },
  retry: { color: colors.accentDark, fontWeight: '800' },
  summary: { backgroundColor: colors.ink, borderRadius: 10, padding: 21, marginBottom: 13 },
  summaryLabel: { color: colors.lime, fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  summaryPrice: { color: colors.surface, fontSize: 43, fontWeight: '800', marginTop: 5 },
  perGallon: { color: colors.lime, fontSize: 14 },
  summaryMeta: { color: colors.surface, fontSize: 12, marginTop: 9 },
  chartCard: { backgroundColor: colors.surface, borderRadius: 9, padding: 18 },
  chartTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 17 },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 19 },
});
