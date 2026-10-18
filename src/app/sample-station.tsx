import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { MoneyPage } from '@/components/MoneyPage';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { sampleFuelPrice, sampleStationById, sampleStationHistory, sampleStationComparison } from '@/features/samples/stations';
import { useSampleDataStore } from '@/features/samples/store';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import type { FuelType } from '@/types/stations';

export default function SampleStationScreen() {
  useThemeRevision();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const visible = useSampleDataStore(state => state.visible);
  const station = sampleStationById(id, visible);
  const comparison = station ? sampleStationComparison(station) : null;
  return <MoneyPage nativeHeader>
    <Stack.Screen options={{ title: 'Sample station' }} />
    <SampleDataControl compact />
    {station ? <>
      <View style={styles.group}><Text style={styles.badge}>SAMPLE · FICTIONAL STATION</Text><Text accessibilityRole="header" style={styles.title}>{station.name}</Text><Text style={styles.note}>{station.address}</Text><Text style={styles.note}>{station.distanceMiles} sample miles away · {station.hours}</Text></View>
      <Text style={styles.note}>Read-only example. These are invented prices, distances and hours, and this location cannot be used for navigation or reports.</Text>
      <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Sample fuel prices</Text>
        {(Object.keys(station.prices) as FuelType[]).map(fuel => <View key={fuel} style={styles.row}><Text style={styles.label}>{fuel.charAt(0).toUpperCase() + fuel.slice(1)}</Text><Text style={styles.amount}>{sampleFuelPrice(station.prices[fuel])}<Text style={styles.note}> /gal</Text></Text></View>)}
        <Text style={styles.note}>Example standard cash/credit prices. No live price reports.</Text>
      </View>
      <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Amenities</Text>{station.amenities.map(amenity => <Text key={amenity} style={styles.label}>✓ {amenity}</Text>)}</View>
      <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Sample price history</Text><Text style={styles.note}>Regular fuel · fictional reports from October 15–18, 2026.</Text><PriceHistoryChart reports={sampleStationHistory(station)} range="all" now={Date.parse('2026-10-18T12:00:00Z')} /></View>
      {comparison && <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Sample trip comparison</Text><Text style={styles.note}>10 gallons · 30 MPG · 2 extra miles · alternative price $3.459/gal. Uses the same calculation as the route planner.</Text><View style={styles.row}><Text style={styles.label}>Savings at the pump</Text><Text style={styles.amount}>${(comparison.priceSavingsCents / 100).toFixed(2)}</Text></View><View style={styles.row}><Text style={styles.label}>Extra driving cost</Text><Text style={styles.amount}>${(comparison.detourCents / 100).toFixed(2)}</Text></View><View style={styles.row}><Text style={styles.label}>Estimated net savings</Text><Text style={styles.amount}>${(comparison.netCents / 100).toFixed(2)}</Text></View><Text style={styles.note}>Fictional assumptions, for preview only. No route or device location is requested.</Text></View>}
      <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Sample fill-up</Text><Text style={styles.badge}>SAMPLE · NOT IN YOUR RECORDS</Text><Text style={styles.note}>{station.refill.date} · {station.refill.gallons} gal at {sampleFuelPrice(station.refill.pricePerGallon)}/gal</Text><Text style={styles.amount}>${(station.refill.totalCents / 100).toFixed(2)}</Text><Text style={styles.note}>This preview does not affect your cars, spending, balance or reports.</Text></View>
    </> : <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>{visible ? 'Sample station unavailable' : 'Sample stations are hidden'}</Text><Text style={styles.note}>{visible ? 'Choose a sample station from the Gas screen.' : 'Your real station search results remain available. Show sample data above to restore this preview.'}</Text></View>}
    <Link href="/(tabs)" asChild><Pressable accessibilityRole="button" style={styles.back}><Text style={styles.backText}>Back to gas stations</Text></Pressable></Link>
  </MoneyPage>;
}

const styles = themedStyles(() => ({
  group: { gap: 10 }, card: { borderRadius: 18, padding: 18, gap: 14, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  badge: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  label: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  amount: { color: colors.ink, fontSize: 22, lineHeight: 29, fontWeight: '600', fontVariant: ['tabular-nums'] },
  back: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
}));
