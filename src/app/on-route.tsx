import { colors } from '@/theme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';

import { geocodeDestination, getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { priceDescription } from '@/features/stations/data';
import { formatFuelPrice } from '@/features/stations/logic';
import { stationsFromSavedLocations, withLocalPrices } from '@/features/stations/localPrices';
import { appleMapsDirections } from '@/features/stations/maps';
import { parseCoordinateDestination, parseDestinationInput, routePrefix, stationsOnRoute } from '@/features/stations/routeLogic';
import type { DriveRoute, RoutePoint } from '@/features/stations/routeLogic';
import { fetchDriveRoute, fetchStationsAlongRoute } from '@/features/stations/routeSearch';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GasStation } from '@/types/stations';

const LONG_DRIVE_MILES = 60;
const LOOKAHEAD_MILES = 120;

export default function OnRouteScreen() {
  const [destinationInput, setDestinationInput] = useState('');
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<RoutePoint | null>(null);
  const [foundStations, setFoundStations] = useState<GasStation[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<'route' | 'stations' | null>(null);
  const [error, setError] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [warning, setWarning] = useState('');
  const request = useRef<AbortController | null>(null);
  const fuelType = useSettingsStore((state) => state.selectedFuelType);
  const receipts = useReceiptStore((state) => state.reports);
  const priceReports = usePriceReportStore((state) => state.reports);
  const lookahead = route ? Math.min(route.miles, LOOKAHEAD_MILES) : 0;
  const path = useMemo(() => route ? routePrefix(route.points, lookahead) : [], [route, lookahead]);
  const stations = useMemo(() => stationsOnRoute(withLocalPrices(foundStations, receipts, priceReports), path, lookahead), [foundStations, receipts, priceReports, path, lookahead]);
  const knownPrices = stations.filter((station) => station.prices.some((price) => price.fuelType === fuelType))
    .sort((a, b) => (a.prices.find((price) => price.fuelType === fuelType)?.price ?? Infinity) - (b.prices.find((price) => price.fuelType === fuelType)?.price ?? Infinity));

  useEffect(() => () => request.current?.abort(), []);

  async function loadStations(nextRoute: DriveRoute, signal: AbortSignal) {
    setBusy('stations');
    const searchPath = routePrefix(nextRoute.points, Math.min(nextRoute.miles, LOOKAHEAD_MILES));
    const savedLocations = stationsFromSavedLocations(receipts, priceReports);
    try {
      const mapped = await fetchStationsAlongRoute(searchPath, signal);
      setFoundStations([...new Map([...savedLocations, ...mapped].map((station) => [station.id, station])).values()]);
      setWarning('');
    } catch (cause) {
      if (signal.aborted || stationsOnRoute(savedLocations, searchPath, Math.min(nextRoute.miles, LOOKAHEAD_MILES)).length === 0) throw cause;
      setFoundStations(savedLocations);
      setWarning('The public map search is unavailable. Showing only stations you saved on this device.');
    }
    setSearched(true);
    setBusy(null);
  }

  async function planTrip() {
    setError('');
    setMapsError('');
    setWarning('');
    setSearched(false);
    setFoundStations([]);
    setRoute(null);
    setBusy(null);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const destination = parseDestinationInput(destinationInput);
    if (!destination) { setError('Enter a destination address, coordinates, or a full Maps link.'); return; }
    if (/^https?:\/\//i.test(destination)) { setError('Could not read a destination from that Maps link. Paste the address or coordinates instead.'); return; }
    setBusy('route');
    try {
      if (!await requestLocationPermission()) throw new Error('Allow location access to plan a trip from your current position.');
      const start = await getCurrentLocation();
      const end = parseCoordinateDestination(destination) ?? await geocodeDestination(destination);
      const result = await fetchDriveRoute(start, end, controller.signal);
      if (controller.signal.aborted) return;
      setOrigin(start);
      setDestinationPoint(end);
      setRoute(result);
      if (result.miles < LONG_DRIVE_MILES) {
        setBusy(null);
        return;
      }
      await loadStations(result, controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setBusy(null);
        setError(cause instanceof Error ? cause.message : 'Could not plan this trip.');
      }
    }
  }

  async function searchShortDrive() {
    if (!route) return;
    setError('');
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      await loadStations(route, controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setBusy(null);
        setError(cause instanceof Error ? cause.message : 'Could not find stations on this trip.');
      }
    }
  }

  async function openMaps(station: GasStation, target: 'apple' | 'google') {
    setMapsError('');
    try {
      if (target === 'apple') {
        await Linking.openURL(appleMapsDirections(station));
      } else {
        const url = new URL('https://www.google.com/maps/dir/');
        url.searchParams.set('api', '1');
        if (origin) url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
        if (destinationPoint) url.searchParams.set('destination', `${destinationPoint.latitude},${destinationPoint.longitude}`);
        url.searchParams.set('waypoints', `${station.latitude},${station.longitude}`);
        url.searchParams.set('travelmode', 'driving');
        await Linking.openURL(url.toString());
      }
    } catch {
      setMapsError('Could not open Maps on this device.');
    }
  }

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>GAS ON YOUR DRIVE</Text>
      <Text style={styles.title}>Stops along the way</Text>
      <Text style={styles.intro}>Enter your destination, or paste a full Apple Maps or Google Maps destination link. GasFinder checks the driving route from your current location.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Destination</Text>
        <TextInput style={styles.input} value={destinationInput} onChangeText={setDestinationInput} placeholder="Address, coordinates, or Maps link" accessibilityLabel="Trip destination" autoCapitalize="words" autoCorrect={false} />
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void planTrip()} disabled={!!busy}><Text style={styles.primaryText}>Check this trip</Text></Pressable>
        <Text style={styles.note}>Trips of 60 miles or more search automatically. For a shorter trip, you can choose to search anyway. This app cannot read an active route from another Maps app. Trip coordinates go to public routing and map lookup services.</Text>
      </View>
      {busy && <View style={styles.status}><ActivityIndicator color={colors.accentDark} /><Text style={styles.note}>{busy === 'route' ? 'Finding the driving route…' : 'Finding gas stations along the route…'}</Text></View>}
      {error ? <View style={styles.status}><Text style={styles.error}>{error}</Text></View> : null}
      {route && <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{route.miles.toFixed(0)} mi · about {Math.round(route.minutes / 60 * 10) / 10} hr</Text>
        <Text style={styles.summaryText}>Looking along the next {lookahead.toFixed(0)} miles of this route.</Text>
        {route.miles < LONG_DRIVE_MILES && !searched && !busy && <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void searchShortDrive()}><Text style={styles.secondaryText}>Find gas on this trip anyway</Text></Pressable>}
      </View>}
      {searched && <View>
        {warning ? <Text style={styles.warning}>{warning}</Text> : null}
        <Text style={styles.sectionTitle}>{knownPrices.length ? `Lowest reported ${fuelType} prices on this route` : `Stations along this route`}</Text>
        {knownPrices.length === 0 && <Text style={styles.note}>No {fuelType} prices have been saved for these stations. The fictional $9.99 example is excluded, so there is no cheapest recommendation yet.</Text>}
        {(knownPrices.length ? knownPrices.slice(0, 8) : stations.slice(0, 8)).map((station) => {
          const price = station.prices.find((item) => item.fuelType === fuelType);
          return <View key={station.id} style={styles.stationCard}>
            <View style={styles.stationTop}><Text style={styles.stationName}>{station.name}</Text><Text style={styles.stationPrice}>{price ? formatFuelPrice(price.price) : 'Price unknown'}</Text></View>
            <Text style={styles.note}>{station.milesAhead.toFixed(0)} mi ahead · within {station.milesOffRoute.toFixed(1)} mi of route</Text>
            <Text style={styles.note}>{station.address}{price ? ` · ${priceDescription(price, false)}` : ''}</Text>
            <View style={styles.mapRow}>
              {Platform.OS === 'ios' && <Pressable accessibilityRole="button" onPress={() => void openMaps(station, 'apple')}><Text style={styles.mapLink}>Stop in Apple Maps ↗</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => void openMaps(station, 'google')}><Text style={styles.mapLink}>Trip via stop in Google Maps ↗</Text></Pressable>
            </View>
          </View>;
        })}
        {stations.length === 0 && <Text style={styles.note}>No stations were found within one mile of this route segment.</Text>}
        {mapsError ? <Text style={styles.error}>{mapsError}</Text> : null}
        <Text style={styles.note}>Route from OSRM; mapped station locations from © OpenStreetMap contributors. Saved locations come from your reports. Prices are unverified. Check the stop and route in Maps before driving.</Text>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 50, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  intro: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 17 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 48, paddingHorizontal: 12, color: colors.ink, fontSize: 15 },
  primaryButton: { backgroundColor: colors.ink, borderRadius: 7, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 12 },
  primaryText: { color: colors.surface, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  status: { backgroundColor: colors.surface, borderRadius: 9, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { color: colors.danger, fontSize: 13 },
  warning: { color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  summary: { backgroundColor: colors.paleGreen, borderRadius: 9, padding: 16 },
  summaryTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  summaryText: { color: colors.inkSoft, fontSize: 13, marginTop: 5 },
  secondaryButton: { borderWidth: 1, borderColor: colors.accentDark, borderRadius: 7, padding: 12, alignSelf: 'flex-start', marginTop: 12 },
  secondaryText: { color: colors.accentDark, fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  stationCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14, marginTop: 8 },
  stationTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  stationName: { color: colors.ink, fontSize: 15, fontWeight: '800', flex: 1 },
  stationPrice: { color: colors.accentDark, fontSize: 15, fontWeight: '800' },
  mapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 },
  mapLink: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
});
