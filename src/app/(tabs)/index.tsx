import { colors } from '@/theme';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { priceDescription, sampleApiBaseUrl, stationApiBaseUrl } from '@/features/stations/data';
import { useNearbyStations } from '@/features/stations/hooks';
import { formatFuelPrice, prepareStations } from '@/features/stations/logic';
import { withReceiptPrices } from '@/features/stations/receiptPrices';
import { useSettingsStore } from '@/stores/settingsStore';
import { useReceiptStore } from '@/stores/receiptStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [mode, setMode] = useState<'demo' | 'nearby' | 'online'>('nearby');
  const receiptReports = useReceiptStore((state) => state.reports);
  const receiptCount = receiptReports.length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'unavailable'>('idle');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function startLocationSearch(nextMode: 'nearby' | 'online') {
    setMode(nextMode);
    if (selectedRadius > 25) setSelectedRadius(25);
    setLocation(null);
    setLocationStatus('loading');
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setLocation(null);
        setLocationStatus('denied');
        return;
      }
      const current = await getCurrentLocation();
      setLocation(current);
      setLocationStatus('idle');
    } catch {
      setLocation(null);
      setLocationStatus('unavailable');
    }
  }

  const { data, isLoading, isFetching, isError, error: searchError, refetch } = useNearbyStations({
    mode,
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });
  const stations = useMemo(() => {
    const found = data?.stations ?? [];
    if (mode === 'demo' || !location) return found;
    return prepareStations(withReceiptPrices(found, receiptReports), { ...location, radius: selectedRadius, fuelType: selectedFuelType, sortOrder });
  }, [data?.stations, mode, location, receiptReports, selectedRadius, selectedFuelType, sortOrder]);
  const cheapest = stations.reduce<(typeof stations)[number] | undefined>((best, station) => {
    const price = station.prices.find((item) => item.fuelType === selectedFuelType)?.price;
    const bestPrice = best?.prices.find((item) => item.fuelType === selectedFuelType)?.price;
    return price !== undefined && (bestPrice === undefined || price < bestPrice) ? station : best;
  }, undefined);
  const cheapestPrice = cheapest?.prices.find((price) => price.fuelType === selectedFuelType);
  const canShowResults = mode === 'demo' || (location !== null && locationStatus === 'idle');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>GASFINDER</Text>
          <Text style={styles.title}>Gas stations</Text>
          <Text style={styles.headerNote}>Find nearby stations and see prices you’ve saved.</Text>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceTitle}>Search source</Text>
          <Text style={styles.sourceText}>
            {mode === 'demo'
              ? 'Sample stations have fictional starting prices. User reports are unverified.'
              : mode === 'nearby'
                ? 'Find real stations around your current location. Search coordinates go to OpenStreetMap’s public lookup; it has locations, not live pump prices.'
                : 'Search uses your location. Prices may be missing or old.'}
          </Text>
          {mode !== 'demo' && location && <Text style={styles.sourceText}>Searching near {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}</Text>}
          {mode === 'nearby' && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}><Text style={styles.sourceText}>© OpenStreetMap contributors · ODbL ↗</Text></Pressable>}
          <View style={styles.pillRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'nearby' }} style={[styles.pill, mode === 'nearby' && styles.activePill]} onPress={() => void startLocationSearch('nearby')}><Text style={[styles.pillText, mode === 'nearby' && styles.activePillText]}>Real stations nearby</Text></Pressable>
            {!!sampleApiBaseUrl && <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'demo' }} style={[styles.pill, mode === 'demo' && styles.activePill]} onPress={() => setMode('demo')}>
              <Text style={[styles.pillText, mode === 'demo' && styles.activePillText]}>Sample data</Text>
            </Pressable>}
            {!!stationApiBaseUrl && <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'online' }} style={[styles.pill, mode === 'online' && styles.activePill]} onPress={() => void startLocationSearch('online')}>
              <Text style={[styles.pillText, mode === 'online' && styles.activePillText]}>Google prices</Text>
            </Pressable>}
          </View>
          {mode === 'nearby' && !location && locationStatus === 'idle' && <Pressable accessibilityRole="button" style={styles.findButton} onPress={() => void startLocationSearch('nearby')}><Text style={styles.findButtonText}>Find stations near me ↗</Text></Pressable>}
        </View>

        <Link href="/report-receipt" asChild>
          <Pressable accessibilityRole="button" style={styles.receiptCard}>
            <View style={styles.receiptCopy}><Text style={styles.receiptTitle}>Gas receipts</Text><Text style={styles.receiptText}>{receiptCount === 0 ? 'Save a receipt and its price on this device.' : `${receiptCount} saved report${receiptCount === 1 ? '' : 's'} · add or review`}</Text></View>
            <Text style={styles.receiptArrow}>›</Text>
          </Pressable>
        </Link>

        <View style={styles.filters}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={styles.filterToggle}>
            <View><Text style={styles.filterToggleTitle}>Filters</Text><Text style={styles.filterSummary}>{selectedFuelType} · {selectedRadius} mi · {sortOrder}</Text></View>
            <Text style={styles.filterChevron}>{filtersOpen ? '−' : '+'}</Text>
          </Pressable>
          {filtersOpen && <>
          <View style={styles.filterPanel}>
            <Text style={styles.sectionTitle}>Fuel</Text>
            <View style={styles.pillRow}>
              {fuelOptions.map((fuel) => (
                <Pressable
                  key={fuel}
                  style={[styles.pill, selectedFuelType === fuel && styles.activePill]}
                  onPress={() => setSelectedFuelType(fuel)}
                >
                  <Text style={[styles.pillText, selectedFuelType === fuel && styles.activePillText]}>{fuel}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterPanel}>
            <Text style={styles.sectionTitle}>Sort</Text>
            <View style={styles.pillRow}>
              {(['price', 'distance'] as const).map((sort) => (
                <Pressable key={sort} style={[styles.pill, sortOrder === sort && styles.activePill]} onPress={() => setSortOrder(sort)}>
                  <Text style={[styles.pillText, sortOrder === sort && styles.activePillText]}>{sort}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterPanel}>
            <Text style={styles.sectionTitle}>Radius</Text>
            <View style={styles.pillRow}>
              {(mode === 'demo' ? [5, 10, 25, 50] : [5, 10, 25]).map((radius) => (
                <Pressable
                  key={radius}
                  style={[styles.pill, selectedRadius === radius && styles.activePill]}
                  onPress={() => setSelectedRadius(radius)}
                >
                  <Text style={[styles.pillText, selectedRadius === radius && styles.activePillText]}>{radius} mi</Text>
                </Pressable>
              ))}
            </View>
          </View>
          </>}
        </View>

        {canShowResults && !isError && cheapest && (
          <View style={styles.highlightCard}>
            <View style={styles.heroTop}><Text style={styles.heroEyebrow}>LOWEST PRICE</Text><Text style={styles.heroBadge}>{cheapestPrice?.source === 'sample' ? 'SAMPLE' : 'UNVERIFIED'}</Text></View>
            <Text style={styles.label}>{selectedFuelType} near you</Text>
            <View style={styles.heroPriceRow}><Text style={styles.priceMain}>{cheapestPrice ? formatFuelPrice(cheapestPrice.price) : '—'}</Text><Text style={styles.perGallon}>/ gallon</Text></View>
            <View style={styles.heroRule} />
            <Text style={styles.heroStation}>{cheapest.name}</Text>
            <Text style={styles.subText}>{cheapest.distanceMiles?.toFixed(1)} mi away · {priceDescription(cheapestPrice, mode === 'demo', now)}</Text>
          </View>
        )}

        {mode !== 'demo' && locationStatus === 'denied' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location access was denied</Text>
            <Text style={styles.emptyText}>Enable location for GasFinder in your device settings, then try again. Sample data is still available.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startLocationSearch(mode)}><Text style={styles.retryText}>Try location again</Text></Pressable>
          </View>
        )}
        {mode !== 'demo' && locationStatus === 'unavailable' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location unavailable</Text>
            <Text style={styles.emptyText}>Check your device location service and try again.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startLocationSearch(mode)}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
        {(locationStatus === 'loading' && mode !== 'demo' || canShowResults && (isLoading || isFetching)) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>{mode === 'demo' ? 'Loading sample stations…' : 'Finding nearby stations…'}</Text>
          </View>
        )}

        {canShowResults && isError && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Station search failed</Text>
            <Text style={styles.emptyText}>{mode === 'demo' ? 'The local sample station server is unavailable. Start it and try again.' : searchError instanceof Error ? `${searchError.message} Check your connection and try again.` : 'Could not load stations. Check your connection and try again.'}</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void refetch()}><Text style={styles.retryText}>Retry search</Text></Pressable>
          </View>
        )}

        {canShowResults && !isLoading && !isError && stations.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionEyebrow}>Stations</Text>
            {mode === 'online' && data?.provider === 'Google Maps' && <Image source={require('../../../assets/google-maps-logo.png')} style={styles.googleLogo} accessibilityLabel="Google Maps" />}
            {mode !== 'demo' && !cheapest && <Text style={styles.noPriceNote}>No reported {selectedFuelType} prices in these results. Station locations are shown below.</Text>}
            {stations.map((station) => (
              <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={station.id === cheapest?.id} isDemo={mode === 'demo'} now={now} canReport={mode === 'demo' && !!sampleApiBaseUrl} canOpenMaps={mode !== 'demo'} canAddReceipt={mode !== 'demo'} onReported={() => void refetch()} />
            ))}
          </View>
        )}

        {canShowResults && !isLoading && !isError && stations.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No stations found in this radius</Text>
            <Text style={styles.emptyText}>Try expanding your search radius.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 },
  headerRow: { marginBottom: 20 },
  brand: { fontSize: 11, fontWeight: '800', letterSpacing: 2.1, color: colors.accentDark, marginBottom: 12 },
  title: { fontSize: 39, lineHeight: 44, letterSpacing: -1.7, fontWeight: '800', color: colors.ink },
  headerNote: { fontSize: 15, color: colors.muted, marginTop: 7 },
  highlightCard: { backgroundColor: colors.ink, borderRadius: 14, padding: 22, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 29 },
  heroEyebrow: { color: colors.lime, fontWeight: '800', letterSpacing: 1.5, fontSize: 11 },
  heroBadge: { color: colors.ink, backgroundColor: colors.lime, overflow: 'hidden', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  label: { fontSize: 14, color: colors.surface, textTransform: 'capitalize' },
  heroPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  priceMain: { fontSize: 62, lineHeight: 69, fontWeight: '800', letterSpacing: -2, color: colors.surface, fontVariant: ['tabular-nums'] },
  perGallon: { color: colors.lime, fontSize: 13, fontWeight: '700' },
  heroRule: { borderTopWidth: 1, borderColor: colors.inkSoft, marginTop: 17, marginBottom: 14 },
  heroStation: { color: colors.surface, fontSize: 17, fontWeight: '800' },
  subText: { marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.lime },
  sourceCard: { backgroundColor: colors.paleGreen, borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 14, marginBottom: 20, gap: 7 },
  findButton: { backgroundColor: colors.ink, borderRadius: 6, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  findButtonText: { color: colors.surface, fontWeight: '800', fontSize: 14 },
  receiptCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 15, minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  receiptCopy: { flex: 1 },
  receiptTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  receiptText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  receiptArrow: { color: colors.accentDark, fontSize: 28, marginLeft: 12 },
  sourceTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  sourceText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  sectionEyebrow: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  filters: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 21 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 45 },
  filterToggleTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  filterSummary: { color: colors.muted, fontSize: 12, textTransform: 'capitalize', marginTop: 3 },
  filterChevron: { color: colors.accentDark, fontSize: 23, fontWeight: '500', paddingHorizontal: 7 },
  filterPanel: { paddingTop: 12, paddingBottom: 13, borderTopWidth: 1, borderColor: colors.line },
  sectionTitle: { fontSize: 12, color: colors.muted, marginBottom: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 5, borderWidth: 1, borderColor: colors.lineStrong, minHeight: 44, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.surface },
  activePill: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', color: colors.inkSoft },
  activePillText: { color: colors.surface },
  loadingBox: { backgroundColor: colors.surface, borderRadius: 8, padding: 18, alignItems: 'center', flexDirection: 'row', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 14 },
  listSection: { marginTop: 4 },
  googleLogo: { width: 98, height: 18, marginVertical: 9 },
  noPriceNote: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 8, padding: 18, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptyText: { marginTop: 8, color: colors.muted },
  retryButton: { marginTop: 14, backgroundColor: colors.ink, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16 },
  retryText: { color: colors.surface, fontWeight: '700' },
});
