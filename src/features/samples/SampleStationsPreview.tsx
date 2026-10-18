import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import type { FuelType } from '@/types/stations';
import { sampleFuelPrice, sampleStations } from './stations';
import { useSampleDataStore } from './store';

export default function SampleStationsPreview({ fuelType }: { fuelType: FuelType }) {
  useThemeRevision();
  const visible = useSampleDataStore(state => state.visible);
  if (!visible) return null;
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.heading}>Sample gas stations</Text>
    <Text style={styles.note}>Fictional locations and prices. Open a station to explore fuel prices, amenities, history and a sample fill-up. These examples work offline.</Text>
    {sampleStations().map((station, index) => <Link key={station.id} href={{ pathname: '/sample-station', params: { id: station.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sample station ${station.name}, ${fuelType} ${sampleFuelPrice(station.prices[fuelType])} per gallon. View sample details.`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.row}><Text style={styles.badge}>SAMPLE{index === 0 ? ' · LOWEST EXAMPLE PRICE' : ''}</Text><AppIcon name="chevron-right" size={17} color={colors.muted} /></View>
        <View style={styles.row}><Text style={styles.name}>{station.name}</Text><Text style={styles.price}>{sampleFuelPrice(station.prices[fuelType])}<Text style={styles.unit}> /gal</Text></Text></View>
        <Text style={styles.note}>{station.distanceMiles} sample mi · {station.hours} · {fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}</Text>
      </Pressable>
    </Link>)}
  </View>;
}

const styles = themedStyles(() => ({
  group: { gap: 12, marginBottom: 28 },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 9, minHeight: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { color: colors.primary, fontSize: 11, lineHeight: 17, fontWeight: '600', flexShrink: 1 },
  name: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '600', flexGrow: 1, flexShrink: 1 },
  price: { color: colors.ink, fontSize: 24, lineHeight: 31, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  pressed: { opacity: 0.7 },
}));
