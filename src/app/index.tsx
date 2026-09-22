import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { useNearbyStations } from '@/features/stations/hooks';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];

export default function HomeScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        const granted = await requestLocationPermission();
        if (!granted) {
          if (isMounted) {
            setPermissionDenied(true);
            setIsLoadingLocation(false);
          }
          return;
        }

        const current = await getCurrentLocation();
        if (isMounted) {
          setLocation(current);
          setPermissionDenied(false);
          setIsLoadingLocation(false);
        }
      } catch {
        if (isMounted) {
          setPermissionDenied(true);
          setIsLoadingLocation(false);
        }
      }
    }

    loadLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  const { data, isLoading, isFetching } = useNearbyStations({
    latitude: location?.latitude ?? 39.9526,
    longitude: location?.longitude ?? -75.1652,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });

  const stations = useMemo(() => data?.stations ?? [], [data?.stations]);
  const cheapest = useMemo(() => {
    if (!stations.length) return null;
    return stations[0];
  }, [stations]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>GasFinder</Text>
          <Text style={styles.settings}>⚙️</Text>
        </View>

        {isLoadingLocation ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#4f8cff" />
            <Text style={styles.loadingText}>Locating nearby stations…</Text>
          </View>
        ) : permissionDenied ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Location access is off</Text>
            <Text style={styles.errorText}>Search for a location manually or enable location access in Settings.</Text>
            <View style={styles.actionsRow}>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Search Location</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Open Settings</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.highlightCard}>
              <Text style={styles.label}>Cheapest {selectedFuelType}</Text>
              <Text style={styles.priceMain}>${cheapest?.prices.find((price) => price.fuelType === selectedFuelType)?.price?.toFixed(2) ?? 'N/A'}</Text>
              <Text style={styles.subText}>{cheapest?.distanceMiles?.toFixed(1) ?? '0.0'} mi away</Text>
              <Pressable style={styles.directionsButton}>
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </Pressable>
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
                <Pressable style={[styles.pill, sortOrder === 'price' && styles.activePill]} onPress={() => setSortOrder('price')}>
                  <Text style={[styles.pillText, sortOrder === 'price' && styles.activePillText]}>Price</Text>
                </Pressable>
                <Pressable style={[styles.pill, sortOrder === 'distance' && styles.activePill]} onPress={() => setSortOrder('distance')}>
                  <Text style={[styles.pillText, sortOrder === 'distance' && styles.activePillText]}>Distance</Text>
                </Pressable>
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

            {(isLoading || isFetching) && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#4f8cff" />
                <Text style={styles.loadingText}>Loading stations…</Text>
              </View>
            )}

            {!isLoading && !isFetching && stations.length > 0 && (
              <View style={styles.listSection}>
                {stations.map((station, index) => (
                  <GasStationCard
                    key={station.id}
                    station={station}
                    fuelType={selectedFuelType}
                    isCheapest={index === 0}
                  />
                ))}
              </View>
            )}

            {!isLoading && !isFetching && stations.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No gas stations found nearby.</Text>
                <Text style={styles.emptyText}>Try expanding your search radius.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  settings: {
    fontSize: 24,
  },
  highlightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e7ebf0',
    marginBottom: 18,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  priceMain: {
    fontSize: 44,
    fontWeight: '800',
    color: '#111827',
    marginTop: 10,
  },
  subText: {
    marginTop: 6,
    fontSize: 16,
    color: '#5f6470',
  },
  directionsButton: {
    marginTop: 18,
    backgroundColor: '#4f8cff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  filterPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ebedf1',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d5dbe4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  activePill: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#374151',
  },
  activePillText: {
    color: '#ffffff',
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingText: {
    color: '#475569',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f2d0d0',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  errorText: {
    marginTop: 8,
    color: '#5f6470',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#f3f6fa',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  listSection: {
    marginTop: 8,
  },
  emptyCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 8,
    color: '#5f6470',
  },
});
