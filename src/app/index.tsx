import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { priceDescription, stationApiBaseUrl } from '@/features/stations/data';
import { useNearbyStations } from '@/features/stations/hooks';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [mode, setMode] = useState<'demo' | 'online'>('demo');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'unavailable'>('idle');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function startOnlineSearch() {
    setMode('online');
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

  const { data, isLoading, isFetching, isError, error, refetch } = useNearbyStations({
    mode,
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });
  const stations = useMemo(() => data?.stations ?? [], [data?.stations]);
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
          <Text style={styles.title}>GasFinder</Text>
          <View style={styles.headerActions}>
            <Link href="/subscriptions" asChild><Pressable style={styles.navButton} accessibilityRole="button"><Text style={styles.navButtonText}>Subscriptions</Text></Pressable></Link>
            <Link href="/report-receipt" asChild><Pressable style={styles.navButton} accessibilityRole="button"><Text style={styles.navButtonText}>Report receipt</Text></Pressable></Link>
            <Link href="/pocket" asChild><Pressable style={styles.navButton} accessibilityRole="button"><Text style={styles.navButtonText}>Savings pocket</Text></Pressable></Link>
            <Link href="/investment" asChild><Pressable style={styles.navButton} accessibilityRole="button"><Text style={styles.navButtonText}>Savings goals</Text></Pressable></Link>
          </View>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceTitle}>{mode === 'demo' ? 'Philadelphia sample' : 'Online station search'}</Text>
          <Text style={styles.sourceText}>
            {mode === 'demo'
              ? 'These stations and prices are fictional samples around Philadelphia. They are not current fuel prices.'
              : 'Search uses your current location. Prices depend on the configured station service.'}
          </Text>
          <View style={styles.pillRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'demo' }} style={[styles.pill, mode === 'demo' && styles.activePill]} onPress={() => setMode('demo')}>
              <Text style={[styles.pillText, mode === 'demo' && styles.activePillText]}>Sample data</Text>
            </Pressable>
            {stationApiBaseUrl ? (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'online' }} style={[styles.pill, mode === 'online' && styles.activePill]} onPress={() => void startOnlineSearch()}>
                <Text style={[styles.pillText, mode === 'online' && styles.activePillText]}>Search near me</Text>
              </Pressable>
            ) : (
              <Text style={styles.sourceText}>Online data is not configured yet.</Text>
            )}
          </View>
        </View>

        {canShowResults && !isError && cheapest && (
          <View style={styles.highlightCard}>
            <Text style={styles.label}>{mode === 'demo' ? 'Lowest sample' : 'Lowest reported'} {selectedFuelType}</Text>
            <Text style={styles.priceMain}>${cheapestPrice?.price.toFixed(2)}</Text>
            <Text style={styles.subText}>{cheapest.distanceMiles?.toFixed(1)} mi away · {priceDescription(cheapestPrice, mode === 'demo', now)}</Text>
          </View>
        )}

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
            {[5, 10, 25, 50].map((radius) => (
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

        {mode === 'online' && locationStatus === 'denied' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location access was denied</Text>
            <Text style={styles.emptyText}>Enable location for GasFinder in your device settings, then try again. Sample data is still available.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startOnlineSearch()}><Text style={styles.retryText}>Try location again</Text></Pressable>
          </View>
        )}
        {mode === 'online' && locationStatus === 'unavailable' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location unavailable</Text>
            <Text style={styles.emptyText}>Check your device location service and try again.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startOnlineSearch()}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
        {(locationStatus === 'loading' && mode === 'online' || canShowResults && (isLoading || isFetching)) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#4f8cff" />
            <Text style={styles.loadingText}>{mode === 'demo' ? 'Loading sample stations…' : 'Finding nearby stations…'}</Text>
          </View>
        )}

        {canShowResults && isError && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Station search failed</Text>
            <Text style={styles.emptyText}>{error instanceof Error ? error.message : 'Please try again.'} No sample prices were substituted.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void refetch()}><Text style={styles.retryText}>Retry search</Text></Pressable>
          </View>
        )}

        {canShowResults && !isLoading && !isError && stations.length > 0 && (
          <View style={styles.listSection}>
            {stations.map((station) => (
              <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={station.id === cheapest?.id} isDemo={mode === 'demo'} now={now} />
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
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  container: { flex: 1, backgroundColor: '#f3f5f7' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  navButton: { borderRadius: 999, backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 16 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  sourceCard: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe', gap: 8 },
  sourceTitle: { color: '#1e3a8a', fontSize: 16, fontWeight: '800' },
  sourceText: { color: '#334155', fontSize: 13, lineHeight: 19 },
  highlightCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#e7ebf0', marginBottom: 18 },
  label: { fontSize: 18, fontWeight: '600', color: '#4b5563', textTransform: 'capitalize' },
  priceMain: { fontSize: 44, fontWeight: '800', color: '#111827', marginTop: 10 },
  subText: { marginTop: 6, fontSize: 16, color: '#5f6470' },
  filterPanel: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#ebedf1' },
  sectionTitle: { fontSize: 14, color: '#6b7280', marginBottom: 10, fontWeight: '600' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: '#d5dbe4', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  activePill: { backgroundColor: '#111827', borderColor: '#111827' },
  pillText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize', color: '#374151' },
  activePillText: { color: '#ffffff' },
  loadingBox: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', gap: 10 },
  loadingText: { color: '#475569', fontSize: 14 },
  listSection: { marginTop: 8 },
  emptyCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 18, padding: 18, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptyText: { marginTop: 8, color: '#5f6470' },
  retryButton: { marginTop: 14, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  retryText: { color: '#ffffff', fontWeight: '700' },
});
