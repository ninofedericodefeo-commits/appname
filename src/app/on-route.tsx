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
import { parseCoordinateDestination, parseDestinationInput, planFuelStop, rankFuelStops, routePrefix, routeWindow, stationsOnRoute } from '@/features/stations/routeLogic';
import type { DriveRoute, FuelStopPlan, RoutePoint } from '@/features/stations/routeLogic';
import { fetchDriveRoute, fetchStationsAlongRoute } from '@/features/stations/routeSearch';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GasStation } from '@/types/stations';

const LONG_DRIVE_MILES = 60;

export default function OnRouteScreen() {
  const [destinationInput, setDestinationInput] = useState('');
  const [fuelUnit, setFuelUnit] = useState<'miles' | 'gallons'>('miles');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [milesPerGallon, setMilesPerGallon] = useState('');
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const [fuelPlan, setFuelPlan] = useState<FuelStopPlan | null>(null);
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
  const lookahead = fuelPlan?.searchEndMiles ?? 0;
  const path = useMemo(() => route ? routePrefix(route.points, lookahead) : [], [route, lookahead]);
  const stations = useMemo(() => stationsOnRoute(withLocalPrices(foundStations, receipts, priceReports), path, lookahead), [foundStations, receipts, priceReports, path, lookahead]);
  const recommended = fuelPlan ? rankFuelStops(stations, fuelPlan, fuelType) : [];
  const knownPrices = recommended.filter((station) => station.prices.some((price) => price.fuelType === fuelType));

  useEffect(() => () => request.current?.abort(), []);

  function clearPlan() {
    request.current?.abort();
    setRoute(null);
    setFuelPlan(null);
    setFoundStations([]);
    setSearched(false);
    setBusy(null);
    setError('');
  }

  async function loadStations(nextRoute: DriveRoute, nextPlan: FuelStopPlan, signal: AbortSignal) {
    setBusy('stations');
    const searchPath = routeWindow(nextRoute.points, nextPlan.searchStartMiles, nextPlan.searchEndMiles);
    const fullPath = routePrefix(nextRoute.points, nextPlan.searchEndMiles);
    const savedLocations = stationsFromSavedLocations(receipts, priceReports);
    try {
      const mapped = await fetchStationsAlongRoute(searchPath, signal);
      setFoundStations([...new Map([...savedLocations, ...mapped].map((station) => [station.id, station])).values()]);
      setWarning('');
    } catch (cause) {
      if (signal.aborted || stationsOnRoute(savedLocations, fullPath, nextPlan.searchEndMiles).length === 0) throw cause;
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
    setFuelPlan(null);
    setBusy(null);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const destination = parseDestinationInput(destinationInput);
    if (!destination) { setError('Enter a destination address, coordinates, or a full Maps link.'); return; }
    if (/^https?:\/\//i.test(destination)) { setError('Could not read a destination from that Maps link. Paste the address or coordinates instead.'); return; }
    const remaining = Number(fuelRemaining.trim());
    const mpg = Number(milesPerGallon.trim());
    if (!fuelRemaining.trim() || !Number.isFinite(remaining) || remaining <= 0 ||
      (fuelUnit === 'miles' && remaining > 1500) ||
      (fuelUnit === 'gallons' && (remaining > 50 || !milesPerGallon.trim() || !Number.isFinite(mpg) || mpg < 1 || mpg > 100 || remaining * mpg > 1500))) {
      setError(fuelUnit === 'miles' ? 'Enter a realistic number of miles left in your tank.' : 'Enter gallons left and your estimated miles per gallon.');
      return;
    }
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
      const nextPlan = planFuelStop(result.miles, fuelUnit === 'miles' ? remaining : remaining * mpg);
      setFuelPlan(nextPlan);
      if (result.miles < LONG_DRIVE_MILES || !nextPlan.needsFuel) {
        setBusy(null);
        return;
      }
      await loadStations(result, nextPlan, controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setBusy(null);
        setError(cause instanceof Error ? cause.message : 'Could not plan this trip.');
      }
    }
  }

  async function searchShortDrive() {
    if (!route || !fuelPlan) return;
    setError('');
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      await loadStations(route, fuelPlan, controller.signal);
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
        <TextInput style={styles.input} value={destinationInput} onChangeText={(value) => { clearPlan(); setDestinationInput(value); }} placeholder="Address, coordinates, or Maps link" accessibilityLabel="Trip destination" autoCapitalize="words" autoCorrect={false} />
        <Text style={styles.label}>How much gas is left?</Text>
        <View style={styles.mapRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: fuelUnit === 'miles' }} style={[styles.unitButton, fuelUnit === 'miles' && styles.unitSelected]} onPress={() => { clearPlan(); setFuelUnit('miles'); }}><Text style={[styles.unitText, fuelUnit === 'miles' && styles.unitTextSelected]}>Miles left</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: fuelUnit === 'gallons' }} style={[styles.unitButton, fuelUnit === 'gallons' && styles.unitSelected]} onPress={() => { clearPlan(); setFuelUnit('gallons'); }}><Text style={[styles.unitText, fuelUnit === 'gallons' && styles.unitTextSelected]}>Gallons left</Text></Pressable>
        </View>
        <TextInput style={styles.input} value={fuelRemaining} onChangeText={(value) => { clearPlan(); setFuelRemaining(value); }} placeholder={fuelUnit === 'miles' ? 'Estimated miles until empty' : 'Gallons in the tank'} accessibilityLabel={fuelUnit === 'miles' ? 'Miles left in tank' : 'Gallons left in tank'} keyboardType="decimal-pad" />
        {fuelUnit === 'gallons' && <><Text style={styles.label}>Your estimated MPG</Text><TextInput style={styles.input} value={milesPerGallon} onChangeText={(value) => { clearPlan(); setMilesPerGallon(value); }} placeholder="Miles per gallon" accessibilityLabel="Estimated miles per gallon" keyboardType="decimal-pad" /></>}
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void planTrip()} disabled={!!busy}><Text style={styles.primaryText}>Check this trip</Text></Pressable>
        <Text style={styles.note}>We aim for a stop before your tank is empty, with a safety buffer. Trips of 60 miles or more search automatically when gas is needed. You can search any trip yourself. This app cannot read an active route from another Maps app. Trip coordinates go to public routing and map lookup services.</Text>
      </View>
      {busy && <View style={styles.status}><ActivityIndicator color={colors.accentDark} /><Text style={styles.note}>{busy === 'route' ? 'Finding the driving route…' : 'Finding gas stations along the route…'}</Text></View>}
      {error ? <View style={styles.status}><Text style={styles.error}>{error}</Text></View> : null}
      {route && <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{route.miles.toFixed(0)} mi · about {Math.round(route.minutes / 60 * 10) / 10} hr</Text>
        {fuelPlan && <Text style={styles.summaryText}>{fuelPlan.needsFuel ? `Aim to stop near mile ${fuelPlan.targetMiles.toFixed(0)}, before about mile ${fuelPlan.lastSafeMiles.toFixed(0)}.` : `Your estimated range reaches the destination. If you search anyway, we check the first ${fuelPlan.searchEndMiles.toFixed(0)} miles.`}</Text>}
        {!searched && !busy && <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void searchShortDrive()}><Text style={styles.secondaryText}>Find gas on this trip anyway</Text></Pressable>}
      </View>}
      {searched && <View>
        {warning ? <Text style={styles.warning}>{warning}</Text> : null}
        <Text style={styles.sectionTitle}>{recommended.length ? 'Suggested fuel stop' : 'No suitable stop found'}</Text>
        {knownPrices.length === 0 && <Text style={styles.note}>No {fuelType} prices have been saved for these stations. Stops are ordered by where you may need fuel; the fictional $9.99 example is excluded.</Text>}
        {recommended.slice(0, 8).map((station, index) => {
          const price = station.prices.find((item) => item.fuelType === fuelType);
          return <View key={station.id} style={styles.stationCard}>
            <View style={styles.stationTop}><Text style={styles.stationName}>{index === 0 ? 'Best stop · ' : ''}{station.name}</Text><Text style={styles.stationPrice}>{price ? formatFuelPrice(price.price) : 'Price unknown'}</Text></View>
            <Text style={styles.note}>{station.milesAhead.toFixed(0)} mi ahead · within {station.milesOffRoute.toFixed(1)} mi of route</Text>
            <Text style={styles.note}>{station.address}{price ? ` · ${priceDescription(price, false)}` : ''}</Text>
            <View style={styles.mapRow}>
              {Platform.OS === 'ios' && <Pressable accessibilityRole="button" onPress={() => void openMaps(station, 'apple')}><Text style={styles.mapLink}>Stop in Apple Maps ↗</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => void openMaps(station, 'google')}><Text style={styles.mapLink}>Trip via stop in Google Maps ↗</Text></Pressable>
            </View>
          </View>;
        })}
        {recommended.length === 0 && <Text style={styles.note}>{fuelPlan?.needsFuel ? 'No stations were found within one mile of the route before your estimated safe range. Try more fuel range or check Maps directly before driving.' : `No stations were found within one mile of the next ${lookahead.toFixed(0)} miles of your route.`}</Text>}
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
  unitButton: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center' },
  unitSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  unitText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  unitTextSelected: { color: colors.surface },
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
