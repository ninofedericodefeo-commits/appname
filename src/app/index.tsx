import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { useNearbyStations } from '@/features/stations/hooks';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
const defaultLocation = { latitude: 39.9526, longitude: -75.1652 };

export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [location, setLocation] = useState(defaultLocation);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        const granted = await requestLocationPermission();
        if (!granted) return;
        const current = await getCurrentLocation();
        if (isMounted) setLocation(current);
      } catch {
        if (isMounted) setLocation(defaultLocation);
      } finally {
        if (isMounted) setIsLoadingLocation(false);
      }
    }

    void loadLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  const { data, isLoading, isFetching } = useNearbyStations({
    latitude: location.latitude,
    longitude: location.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });
  const stations = useMemo(() => data?.stations ?? [], [data?.stations]);
  const cheapest = stations[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>GasFinder</Text>
          <Link href="/investment" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Investing</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.label}>Cheapest {selectedFuelType}</Text>
          <Text style={styles.priceMain}>
            ${cheapest?.prices.find((price) => price.fuelType === selectedFuelType)?.price?.toFixed(2) ?? 'N/A'}
          </Text>
          <Text style={styles.subText}>{cheapest?.distanceMiles?.toFixed(1) ?? '0.0'} mi away</Text>
        </View>

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

        {(isLoadingLocation || isLoading || isFetching) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#4f8cff" />
            <Text style={styles.loadingText}>Finding nearby stations…</Text>
          </View>
        )}

        {!isLoading && !isFetching && stations.length > 0 && (
          <View style={styles.listSection}>
            {stations.map((station, index) => (
              <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={index === 0} />
            ))}
          </View>
        )}

        {!isLoading && !isFetching && stations.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No test stations found nearby.</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  navButton: { borderRadius: 999, backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 16 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
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
});
