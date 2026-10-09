import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import StationMap from '@/components/StationMap';
import { geocodeDestination, getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { priceDescription } from '@/features/stations/data';
import { formatFuelPrice } from '@/features/stations/logic';
import { stationsFromSavedLocations, withLocalPrices } from '@/features/stations/localPrices';
import { appleMapsDirections, appleMapsTrip, googleMapsDirections, googleMapsTripSegments } from '@/features/stations/maps';
import { planDriveStops, safeRange } from '@/features/stations/multiStopLogic';
import type { DriveStopPlan, PlannedStop, StopWindow } from '@/features/stations/multiStopLogic';
import { driveRouteWindow, parseCoordinateDestination, routeQueryPoints, stationsOnRoute } from '@/features/stations/routeLogic';
import type { DriveRoute, RoutePoint } from '@/features/stations/routeLogic';
import { fetchDriveRoute, fetchStationsAlongRoute, resolveMapsDestination } from '@/features/stations/routeSearch';
import { fuelRange } from '@/features/vehicles/logic';
import { useDriveStore } from '@/stores/driveStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors } from '@/theme';

export default function OnRouteScreen() {
  const params = useLocalSearchParams<{ destination?: string; handoff?: string }>();
  const { cars, selectedCarId, lastDestination, selectCar, setDestination } = useDriveStore();
  const hydrated = useSyncExternalStore(useDriveStore.persist.onFinishHydration, useDriveStore.persist.hasHydrated, () => false);
  const car = cars.find((item) => item.id === selectedCarId);
  const [destinationInput, setDestinationInput] = useState('');
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fuelUnit, setFuelUnit] = useState<'percent' | 'gallons'>('percent');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [plan, setPlan] = useState<DriveStopPlan | null>(null);
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [warning, setWarning] = useState('');
  const request = useRef<AbortController | null>(null);
  const destinationTouched = useRef(false);
  const previousCar = useRef<string | null>(null);
  const fuelType = useSettingsStore((state) => state.selectedFuelType);
  const receipts = useReceiptStore((state) => state.reports);
  const priceReports = usePriceReportStore((state) => state.reports);
  const range = useMemo(() => {
    try { return car && fuelRemaining.trim() ? fuelRange(car, Number(fuelRemaining), fuelUnit) : null; }
    catch { return null; }
  }, [car, fuelRemaining, fuelUnit]);
  const mapPins = useMemo(() => stops.map(({ station }, index) => ({ id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude, price: station.prices.find((item) => item.fuelType === fuelType && item.source !== 'sample')?.price ?? null, sample: false, stopNumber: index + 1 })), [stops, fuelType]);
  const mapRoute = useMemo(() => route ? routeQueryPoints(route.points, 500) : [], [route]);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const selectPin = useCallback(async (id: string) => setSelectedStop(id), []);

  const clearPlan = useCallback(() => {
    request.current?.abort(); setRoute(null); setPlan(null); setStops([]); setBusy(''); setError(''); setWarning(''); setMapsError(''); setSelectedStop(null);
  }, []);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (params.destination) {
      // Apply a new destination delivered by an external Maps share or Shortcut.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearPlan(); setDestinationInput(params.destination); if (hydrated) setDestination(params.destination); setDestinationOpen(false); destinationTouched.current = true;
    }
  }, [params.destination, params.handoff, hydrated, clearPlan, setDestination]);
  useEffect(() => {
    if (hydrated && !destinationTouched.current && !params.destination) setDestinationInput(lastDestination);
  }, [hydrated, lastDestination, params.destination]);
  useEffect(() => {
    // Invalidate a trip when a car profile edited on another screen or its fuel type changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clearPlan();
    if (previousCar.current !== (car?.id ?? null)) setFuelRemaining('');
    previousCar.current = car?.id ?? null;
  }, [car?.id, car?.mpg, car?.tankGallons, fuelType, clearPlan]);

  async function pasteDestination() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) throw new Error('Copy a Maps destination link or address first.');
      clearPlan(); setDestinationInput(text.trim()); setDestinationOpen(true); destinationTouched.current = true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not paste. You can type or paste into the destination field.'); }
  }

  async function loadStops(nextRoute: DriveRoute, initialRange: number, fullRange: number, signal: AbortSignal, forceSearch = false) {
    setStops([]); setPlan(null); setWarning('');
    const saved = stationsFromSavedLocations(receipts, priceReports);
    const lookup = async (window: StopWindow) => {
      if (signal.aborted) throw new Error('Trip changed.');
      setBusy(`Finding stop ${Math.max(1, Math.floor(window.fromMiles / Math.max(1, fullRange)) + 1)} near mile ${Math.round(window.targetMiles)}…`);
      let found = saved;
      try {
        const mapped = await fetchStationsAlongRoute(driveRouteWindow(nextRoute, window.searchStartMiles, window.searchEndMiles), signal);
        found = [...new Map([...saved, ...mapped].map((station) => [station.id, station])).values()];
      } catch (cause) {
        if (signal.aborted || stationsOnRoute(saved, nextRoute.points, nextRoute.miles).length === 0) throw cause;
        setWarning('Public station search is unavailable. Only locations you saved on this device are being checked.');
      }
      if (signal.aborted) throw new Error('Trip changed.');
      return stationsOnRoute(withLocalPrices(found, receipts, priceReports), nextRoute.points, nextRoute.miles);
    };
    const result = await planDriveStops({ routeMiles: nextRoute.miles, initialRange, fullRange, fuelType, forceSearch, lookup, onProgress: (progress) => { if (!signal.aborted) setStops(progress); } });
    if (!signal.aborted) { setPlan(result); setStops(result.stops); setBusy(''); }
  }

  async function planTrip() {
    clearPlan();
    const controller = new AbortController(); request.current = controller;
    try {
      if (!car) throw new Error('Add or select the car you’re driving.');
      if (!fuelRemaining.trim()) throw new Error('Choose a tank percentage or enter gallons left.');
      const estimate = fuelRange(car, Number(fuelRemaining), fuelUnit);
      if (!destinationInput.trim()) throw new Error('Paste or enter your Maps destination.');
      setBusy('Reading destination and finding your location…');
      const destination = await resolveMapsDestination(destinationInput, controller.signal);
      if (!await requestLocationPermission()) throw new Error('Allow location access to plan from your current position.');
      const start = await getCurrentLocation();
      const destinationPoint = parseCoordinateDestination(destination) ?? await geocodeDestination(destination);
      if (controller.signal.aborted) return;
      setBusy('Finding the driving route…');
      const nextRoute = await fetchDriveRoute(start, destinationPoint, controller.signal);
      if (controller.signal.aborted) return;
      setDestination(destination); setDestinationInput(destination); setDestinationOpen(false);
      setRoute(nextRoute); setOrigin(start); setEnd(destinationPoint);
      await loadStops(nextRoute, estimate.initialRange, estimate.fullRange, controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) { setBusy(''); setError(cause instanceof Error ? cause.message : 'Could not plan your trip.'); }
    }
  }

  async function searchAnyway() {
    if (!route || !range) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setError('');
    try { await loadStops(route, range.initialRange, range.fullRange, controller.signal, true); }
    catch (cause) { if (!controller.signal.aborted) { setBusy(''); setError(cause instanceof Error ? cause.message : 'Could not find fuel stops.'); } }
  }
  async function openMaps(url: string) { setMapsError(''); try { await Linking.openURL(url); } catch { setMapsError('Could not open Maps on this device.'); } }
  const googleSegments = end && plan?.complete ? googleMapsTripSegments(end, stops.map((stop) => stop.station)) : [];
  const modernAppleMaps = Platform.OS === 'ios' && Number.parseFloat(String(Platform.Version)) >= 18.4;
  const shareAvailable = Platform.OS === 'android' || Constants.expoConfig?.extra?.mapsShareAvailable === true;

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>GAS ON YOUR DRIVE</Text><Text style={styles.title}>{'Pick your car.\nPlan your stops.'}</Text>
      <View style={styles.card}>
        <View style={styles.headingRow}><Text style={styles.heading}>1 · What are you driving?</Text><Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Manage cars</Text></Pressable></Link></View>
        <View style={styles.row}>{cars.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === car?.id }} onPress={() => { clearPlan(); selectCar(item.id); }} style={[styles.choice, item.id === car?.id && styles.selected]}><Text style={[styles.choiceText, item.id === car?.id && styles.selectedText]}>{item.name}</Text></Pressable>)}
          <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.choice}><Text style={styles.choiceText}>+ Add car</Text></Pressable></Link></View>
        {car && <Text style={styles.note}>{car.mpg} MPG · {car.tankGallons} US gal tank · editable estimates</Text>}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>2 · How full is the tank?</Text>
        <View style={styles.row}>{(['percent', 'gallons'] as const).map((unit) => <Pressable key={unit} accessibilityRole="button" accessibilityState={{ selected: fuelUnit === unit }} style={[styles.choice, fuelUnit === unit && styles.selected]} onPress={() => { clearPlan(); setFuelRemaining(''); setFuelUnit(unit); }}><Text style={[styles.choiceText, fuelUnit === unit && styles.selectedText]}>{unit === 'percent' ? 'Percent left' : 'Gallons left'}</Text></Pressable>)}</View>
        {fuelUnit === 'percent' && <View style={styles.row}>{[10, 25, 50, 75, 100].map((percent) => <Pressable key={percent} accessibilityRole="button" accessibilityLabel={`${percent} percent of tank left`} accessibilityState={{ selected: fuelRemaining === String(percent) }} onPress={() => { clearPlan(); setFuelRemaining(String(percent)); }} style={[styles.choice, fuelRemaining === String(percent) && styles.selected]}><Text style={[styles.choiceText, fuelRemaining === String(percent) && styles.selectedText]}>{percent}%</Text></Pressable>)}</View>}
        <TextInput style={styles.input} value={fuelRemaining} onChangeText={(value) => { clearPlan(); setFuelRemaining(value); }} placeholder={fuelUnit === 'percent' ? 'Or enter a percentage' : 'US gallons remaining'} accessibilityLabel={fuelUnit === 'percent' ? 'Tank percentage left' : 'US gallons left in tank'} keyboardType="decimal-pad" />
        {range && <Text style={styles.range}>~{Math.floor(safeRange(range.initialRange))} mi before a refill · ~{range.gallons.toFixed(1)} gal</Text>}
        <Text style={styles.note}>Fuel level is requested for every new drive. Range uses your saved car estimates, a 15% reduction and a reserve. Check your tank size in Manage cars before using percent.</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.headingRow}><Text style={styles.heading}>3 · Destination</Text>{!!destinationInput && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => setDestinationOpen(!destinationOpen)}><Text style={styles.link}>{destinationOpen ? 'Done' : 'Change'}</Text></Pressable>}</View>
        {destinationInput && !destinationOpen ? <Text style={styles.destination} numberOfLines={3}>{destinationInput}</Text> : <TextInput style={styles.input} value={destinationInput} onChangeText={(value) => { clearPlan(); setDestinationInput(value); destinationTouched.current = true; }} placeholder="Address, coordinates or Maps link" accessibilityLabel="Trip destination" autoCorrect={false} />}
        <View style={styles.row}><Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void pasteDestination()}><Text style={styles.link}>Paste from Maps</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} style={styles.textButton} onPress={() => setHelpOpen(!helpOpen)}><Text style={styles.link}>Connect Maps</Text></Pressable></View>
        {helpOpen && <View style={styles.help}>
          <Text style={styles.note}>Maps keeps its current route private. Share the destination place to GasFinder{shareAvailable ? ' using the Maps share sheet' : ', or copy its link and tap Paste from Maps'}. We remember that destination for next time; check it before each trip.</Text>
          {Platform.OS === 'ios' && !shareAvailable && <Text style={styles.note}>For one-tap sharing with a free Apple account: create a Shortcut that accepts URLs/Text from the share sheet, URL-encodes Shortcut Input, builds the text gasfinder://on-route?destination=[Encoded Text], then opens that text as a URL. Name it “Gas on my drive”. In Maps, share a destination to that Shortcut.</Text>}
          <Text style={styles.note}>GasFinder plans a route from your current location; Maps may choose different roads. Trip coordinates are sent to public OSRM and OpenStreetMap services. No paid map key is needed.</Text>
        </View>}
      </View>
      <Pressable accessibilityRole="button" disabled={!!busy || !hydrated} style={[styles.primary, !!busy && styles.disabled]} onPress={() => void planTrip()}><Text style={styles.primaryText}>{busy ? 'Planning…' : 'Plan fuel stops'}</Text></Pressable>
      {!!busy && <View style={styles.status}><ActivityIndicator color={colors.accentDark} /><Text style={styles.note}>{busy}</Text><Pressable accessibilityRole="button" style={styles.textButton} onPress={clearPlan}><Text style={styles.link}>Cancel</Text></Pressable></View>}
      {!!error && <Text style={styles.error}>{error}{stops.length ? ' Stops shown so far do not cover the full trip.' : ''}</Text>}
      {route && <>
        <View style={styles.summary}><Text style={styles.heading}>{Math.round(route.miles)} mi · ~{(route.minutes / 60).toFixed(1)} hr</Text>
          <Text style={styles.note}>{plan ? plan.complete ? plan.needsFuel ? `${stops.length} fuel stop${stops.length === 1 ? '' : 's'} planned. Refill to full at each stop.` : stops.length ? 'Optional fuel stop. Your estimated range reaches the destination.' : 'Your estimated range reaches the destination.' : 'Building the fuel plan…' : busy ? 'Stops will appear as they are found.' : 'Fuel plan unavailable. Replan before driving.'}</Text>
          {plan?.reason && <Text style={styles.error}>{plan.reason} Check Maps or refuel earlier before driving.</Text>}
          {plan?.complete && !plan.needsFuel && stops.length === 0 && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void searchAnyway()}><Text style={styles.link}>Find gas on this trip anyway</Text></Pressable>}
        </View>
        <View style={styles.mapFrame}><StationMap pins={mapPins} center={origin} route={mapRoute} selectedId={selectedStop} onSelect={selectPin} dom={{ useExpoDOMWebView: false, style: { height: 370 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} /></View>
        {!!warning && <Text style={styles.error}>{warning}</Text>}
        {stops.map(({ station, legMiles }, index) => {
          const price = station.prices.find((item) => item.fuelType === fuelType && item.source !== 'sample');
          return <View key={station.id} style={[styles.card, selectedStop === station.id && styles.stopSelected]}>
            <Text style={styles.kicker}>STOP {index + 1} · REFILL TO FULL</Text>
            <View style={styles.headingRow}><Text style={styles.heading}>{station.name}</Text><Text style={styles.price}>{price ? formatFuelPrice(price.price) : 'Unknown price'}</Text></View>
            <Text style={styles.note}>Mile {Math.round(station.milesAhead)} · ~{Math.round(legMiles)} mi this leg · ~{station.milesOffRoute.toFixed(1)} mi off route</Text>
            <Text style={styles.note}>{station.address}{price ? ` · ${priceDescription(price, false)}` : ` · no saved ${fuelType} price`}</Text>
            <View style={styles.row}>{Platform.OS === 'ios' && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(appleMapsDirections(station))}><Text style={styles.link}>To this stop · Apple ↗</Text></Pressable>}<Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(googleMapsDirections(station))}><Text style={styles.link}>To this stop · Google ↗</Text></Pressable></View>
          </View>;
        })}
        {end && plan?.complete && <View style={styles.card}><Text style={styles.heading}>Open the planned trip</Text>
          {modernAppleMaps && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(appleMapsTrip(end, stops.map((stop) => stop.station)))}><Text style={styles.link}>Apple Maps · all {stops.length} stops + destination ↗</Text></Pressable>}
          {Platform.OS === 'ios' && !modernAppleMaps && <Text style={styles.note}>All-stop Apple Maps links require iOS 18.4+. Use each stop’s directions above on this iPhone.</Text>}
          {googleSegments.map((segment, index) => <Pressable key={segment.url} accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(segment.url)}><Text style={styles.link}>{googleSegments.length > 1 ? `Google Maps · part ${index + 1}/${googleSegments.length}${segment.firstStop <= segment.lastStop ? ` · stops ${segment.firstStop}–${segment.lastStop}` : ''}${segment.reachesDestination ? ' + destination' : ''}` : `Google Maps · ${stops.length} stops + destination`} ↗</Text></Pressable>)}
          {googleSegments.length > 1 && <Text style={styles.note}>Google mobile links limit waypoints. All stops are kept in these parts; open the next part after finishing the previous one.</Text>}
        </View>}
        {!!mapsError && <Text style={styles.error}>{mapsError}</Text>}
        <Text style={styles.note}>Stops favor nearby saved prices around each refill point; without reports, distance decides. Prices and range are estimates. Station proximity is measured from the route, not verified road access. Confirm exits, opening hours and fuel level in Maps. Route: OSRM · stations/map: © OpenStreetMap contributors.</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 50, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 35, lineHeight: 39, fontWeight: '800', marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 16, gap: 10 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, heading: { color: colors.ink, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center', maxWidth: '100%' },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceText: { color: colors.ink, fontSize: 13, fontWeight: '700' }, selectedText: { color: colors.surface },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 48, paddingHorizontal: 12, color: colors.ink, fontSize: 15 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, range: { color: colors.ink, fontSize: 15, fontWeight: '800' }, destination: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  primary: { backgroundColor: colors.ink, borderRadius: 7, alignItems: 'center', justifyContent: 'center', minHeight: 50 }, primaryText: { color: colors.surface, fontWeight: '800' }, disabled: { opacity: 0.6 },
  textButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.accentDark, fontSize: 12, fontWeight: '800' }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  help: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, gap: 10 }, status: { backgroundColor: colors.surface, borderRadius: 9, padding: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  summary: { backgroundColor: colors.paleGreen, borderRadius: 9, padding: 16, gap: 8 }, mapFrame: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden' },
  stopSelected: { borderColor: colors.accentDark, borderWidth: 2 }, price: { color: colors.accentDark, fontSize: 15, fontWeight: '800' },
});
