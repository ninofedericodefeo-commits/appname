import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { distanceMiles, getStationsAlongRoute, type Coordinate } from '@/features/trip-planning/tripMath';
import { mockStations } from '@/features/stations/mockData';
import { useNearbyStations } from '@/features/stations/hooks';
import { useDriveStore } from '@/stores/driveStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
const defaultLocation = { latitude: 39.9526, longitude: -75.1652 };
const demoDestinations: { name: string; location: Coordinate }[] = [
  { name: 'Philadelphia Airport', location: { latitude: 39.8744, longitude: -75.2424 } },
  { name: 'King of Prussia', location: { latitude: 40.0887, longitude: -75.396 } },
  { name: 'Camden Waterfront', location: { latitude: 39.9437, longitude: -75.1201 } },
];

export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const {
    trackingEnabled,
    vehicleName,
    tankCapacityGallons,
    milesPerGallon,
    currentFuelGallons,
    milesSinceRefuel,
    lowFuelPercent,
    trackingError,
    markRefueled,
    destinationName,
    destination,
    setDestination,
    clearDestination,
  } = useDriveStore();
  const [location, setLocation] = useState(defaultLocation);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isUsingDemoLocation, setIsUsingDemoLocation] = useState(true);
  const [refuelInput, setRefuelInput] = useState('');
  const [refuelError, setRefuelError] = useState<string | null>(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [destinationError, setDestinationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        const granted = await requestLocationPermission();
        if (!granted) return;
        const current = await getCurrentLocation();
        if (isMounted) {
          setLocation(current);
          setIsUsingDemoLocation(false);
        }
      } catch {
        if (isMounted) {
          setLocation(defaultLocation);
          setIsUsingDemoLocation(true);
        }
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
  const routeStations = useMemo(
    () => (destination ? getStationsAlongRoute(mockStations, location, destination) : []),
    [destination, location],
  );

  async function recordRefuel(gallonsAdded: number, filledTank: boolean) {
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        throw new Error('Allow location access while using the app to record a refuel for your trip estimate.');
      }
      const current = await getCurrentLocation();
      setLocation(current);
      setIsUsingDemoLocation(false);
      markRefueled(gallonsAdded, filledTank, current);
      setRefuelInput('');
      setRefuelError(null);
    } catch (error) {
      setRefuelError(error instanceof Error ? error.message : 'Unable to record the refuel.');
    }
  }

  function selectDestination(name: string, coordinates: Coordinate) {
    setDestination(name, coordinates);
    setDestinationInput(`${coordinates.latitude}, ${coordinates.longitude}`);
    setDestinationError(null);
  }

  function resetDestination() {
    clearDestination();
    setDestinationInput('');
    setDestinationError(null);
  }

  function useCustomDestination() {
    const match = destinationInput.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) {
      setDestinationError('Enter destination coordinates as latitude, longitude.');
      return;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setDestinationError('Those coordinates are outside the valid latitude/longitude range.');
      return;
    }

    setDestination('Custom destination', { latitude, longitude });
    setDestinationError(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>GasFinder</Text>
          <View style={styles.headerActions}>
            {Platform.OS !== 'web' ? (
              <Link href="/vehicle-settings" asChild>
                <Pressable style={styles.navButton} accessibilityRole="button">
                  <Text style={styles.navButtonText}>Car settings</Text>
                </Pressable>
              </Link>
            ) : null}
            <Link href="/investment" asChild>
              <Pressable style={styles.navButton} accessibilityRole="button">
                <Text style={styles.navButtonText}>Investing</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.label}>Cheapest {selectedFuelType}</Text>
          <Text style={styles.priceMain}>
            ${cheapest?.prices.find((price) => price.fuelType === selectedFuelType)?.price?.toFixed(2) ?? 'N/A'}
          </Text>
          <Text style={styles.subText}>{cheapest?.distanceMiles?.toFixed(1) ?? '0.0'} mi away</Text>
        </View>

        {Platform.OS !== 'web' ? (
          <View style={styles.tripPanel}>
            <Text style={styles.tripTitle}>Fuel estimate</Text>
            {vehicleName ? (
              <>
                <Text style={styles.routeSummary}>{vehicleName}</Text>
                {currentFuelGallons === null ? (
                  <Text style={styles.tripText}>Log your next refuel to start estimating fuel use.</Text>
                ) : (
                  <>
                    <Text style={styles.fuelValue}>
                      {currentFuelGallons.toFixed(1)} / {tankCapacityGallons.toFixed(1)} gal estimated
                    </Text>
                    <Text style={styles.tripText}>
                      About {(currentFuelGallons * milesPerGallon).toFixed(0)} mi range · {milesSinceRefuel.toFixed(1)} mi since refuel
                    </Text>
                    {currentFuelGallons <= (tankCapacityGallons * lowFuelPercent) / 100 ? (
                      <Text style={styles.lowFuelText}>Potentially low: below your {lowFuelPercent}% threshold.</Text>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <Text style={styles.tripText}>Configure your car in settings to start a fuel estimate.</Text>
            )}
            <Link href="/vehicle-settings" asChild>
              <Pressable style={styles.secondaryButton} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Car and alert settings</Text>
              </Pressable>
            </Link>
            {vehicleName ? (
              <>
                {currentFuelGallons !== null ? (
                  <>
                    <TextInput
                      accessibilityLabel="Gallons added at refuel"
                      keyboardType="decimal-pad"
                      onChangeText={setRefuelInput}
                      placeholder="Gallons added"
                      style={styles.textInput}
                      value={refuelInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const gallons = Number(refuelInput);
                        if (!refuelInput.trim() || !Number.isFinite(gallons) || gallons <= 0) {
                          setRefuelError('Enter the number of gallons added at the pump.');
                          return;
                        }
                        if (gallons > tankCapacityGallons) {
                          setRefuelError('Gallons added cannot exceed your configured tank capacity.');
                          return;
                        }
                        void recordRefuel(gallons, false);
                      }}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Log partial refuel</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.tripText}>
                    For a reliable starting estimate, log your next fill-up when the tank is full.
                  </Text>
                )}
                {refuelError ? <Text accessibilityRole="alert" style={styles.errorText}>{refuelError}</Text> : null}
                <View style={styles.buttonRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void recordRefuel(0, true)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{currentFuelGallons === null ? 'Log a full-tank refuel' : 'I filled the tank'}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
            <Text style={styles.disclaimerText}>
              Fuel used is an estimate from background trip distance and your configured MPG. Refueling must be logged by you.
            </Text>
            {trackingEnabled ? <Text style={styles.tripText}>Mobile trip tracking is enabled.</Text> : null}
            {trackingError ? <Text accessibilityRole="alert" style={styles.errorText}>{trackingError}</Text> : null}
            {isUsingDemoLocation ? (
              <Text style={styles.demoLocationText}>Using the Philadelphia demo location until device location is available.</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tripPanel}>
          <Text style={styles.tripTitle}>Gas stations on your way</Text>
          <Text style={styles.tripText}>Choose a local demo destination or enter coordinates. No address lookup or route service is used.</Text>
          <View style={styles.pillRow}>
            {demoDestinations.map((item) => (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                onPress={() => selectDestination(item.name, item.location)}
                style={[styles.pill, destinationName === item.name && styles.activePill]}
              >
                <Text style={[styles.pillText, destinationName === item.name && styles.activePillText]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Destination coordinates"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            onChangeText={setDestinationInput}
            placeholder="Latitude, longitude"
            style={styles.textInput}
            value={destinationInput}
          />
          <View style={styles.buttonRow}>
            <Pressable accessibilityRole="button" onPress={useCustomDestination} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Use coordinates</Text>
            </Pressable>
            {destination ? (
              <Pressable accessibilityRole="button" onPress={resetDestination} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {destinationError ? <Text accessibilityRole="alert" style={styles.errorText}>{destinationError}</Text> : null}
          {destination ? (
            <>
              <Text style={styles.routeSummary}>
                {destinationName} · direct-line estimate from your current location ·{' '}
                {distanceMiles(location, destination).toFixed(1)} mi
              </Text>
              <Text style={styles.disclaimerText}>
                Suggestions use a straight-line corridor, not road directions. Stations and prices are local demo data.
              </Text>
              {routeStations.length > 0 ? (
                routeStations.map(({ station, milesFromStart, milesOffRoute }) => {
                  const price = station.prices.find((item) => item.fuelType === selectedFuelType)?.price;
                  return (
                    <View key={station.id} style={styles.routeStation}>
                      <View style={styles.routeStationInfo}>
                        <Text style={styles.routeStationName}>{station.name}</Text>
                        <Text style={styles.tripText}>
                          {milesFromStart.toFixed(1)} mi along · {milesOffRoute.toFixed(1)} mi off line
                        </Text>
                      </View>
                      <Text style={styles.routeStationPrice}>${price?.toFixed(2) ?? 'N/A'}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.tripText}>No sample stations fall along this direct route.</Text>
              )}
            </>
          ) : null}
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
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  navButton: { borderRadius: 999, backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 16 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  highlightCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#e7ebf0', marginBottom: 18 },
  label: { fontSize: 18, fontWeight: '600', color: '#4b5563', textTransform: 'capitalize' },
  priceMain: { fontSize: 44, fontWeight: '800', color: '#111827', marginTop: 10 },
  subText: { marginTop: 6, fontSize: 16, color: '#5f6470' },
  tripPanel: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e7ebf0', gap: 10 },
  tripTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  fuelValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  lowFuelText: { color: '#b42318', fontSize: 13, fontWeight: '800' },
  tripText: { fontSize: 13, lineHeight: 19, color: '#596273' },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputColumn: { flex: 1, gap: 5 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#596273' },
  textInput: { minHeight: 44, borderWidth: 1, borderColor: '#d5dbe4', borderRadius: 10, paddingHorizontal: 12, color: '#111827', backgroundColor: '#ffffff' },
  primaryButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#111827', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#d5dbe4', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#374151', fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  disclaimerText: { fontSize: 11, lineHeight: 16, color: '#7a7f89' },
  errorText: { color: '#b42318', fontSize: 12, lineHeight: 17 },
  demoLocationText: { color: '#92400e', fontSize: 12, lineHeight: 17 },
  routeSummary: { color: '#111827', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  routeStation: { borderTopWidth: 1, borderTopColor: '#edf0f3', flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 },
  routeStationInfo: { flex: 1 },
  routeStationName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  routeStationPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
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
