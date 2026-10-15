import { reviewRoutedLegs, detourEconomics } from '@/features/stations/tripReview';
import { formatMoney } from '@/lib/money';
import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import StationMap from '@/components/StationMap';
import { geocodeDestination, getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { priceDescription } from '@/features/stations/data';
import { formatFuelPrice, isRecentPrice } from '@/features/stations/logic';
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
import { preferredMapsApp } from '@/features/stations/preferences';

export default function OnRouteScreen() {
  const params = useLocalSearchParams<{ destination?: string; handoff?: string }>();
  const { cars, selectedCarId, lastDestination, destinations, preferredStationIds, avoidedStationIds, saveDestination, removeDestination, setStationPreference, selectCar, setDestination } = useDriveStore();
  const hydrated = useSyncExternalStore(useDriveStore.persist.onFinishHydration, useDriveStore.persist.hasHydrated, () => false);
  const car = cars.find((item) => item.id === selectedCarId);
  const [destinationInput, setDestinationInput] = useState('');
  const [fuelUnit, setFuelUnit] = useState<'percent' | 'gallons'>('percent');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [plan, setPlan] = useState<DriveStopPlan | null>(null);
  const [refillTarget, setRefillTarget] = useState('100'), [alternativePrice, setAlternativePrice] = useState(''), [access, setAccess] = useState<{ message: string; complete: boolean; extraMiles: number; points?: RoutePoint[] } | null>(null);
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [warning, setWarning] = useState('');
  const request = useRef<AbortController | null>(null);
  const destinationTouched = useRef(false);
  const previousCar = useRef<string | null>(null);
  const { selectedFuelType: fuelType, mapsPreference, refillPercent, priceQualifier } = useSettingsStore();
  const mapsApp = preferredMapsApp(mapsPreference, Platform.OS);
  const mapsName = mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps';
  const receipts = useReceiptStore((state) => state.reports);
  const priceReports = usePriceReportStore((state) => state.reports);
  const range = useMemo(() => {
    try { return car && fuelRemaining.trim() ? fuelRange(car, Number(fuelRemaining), fuelUnit) : null; }
    catch { return null; }
  }, [car, fuelRemaining, fuelUnit]);
  const [priceCheckedAt, setPriceCheckedAt] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setPriceCheckedAt(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const mapPins = useMemo(() => stops.map(({ station }, index) => { const price = station.prices.find(item => item.fuelType === fuelType && item.source !== 'sample'); return { id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude, price: price?.price ?? null, sample: false, stopNumber: index + 1, stale: !!price && !isRecentPrice(price, priceCheckedAt) }; }), [stops, fuelType, priceCheckedAt]);
  const mapRoute = useMemo(() => route ? routeQueryPoints(access?.points ?? route.points, 500) : [], [route,access]);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const selectPin = useCallback(async (id: string) => setSelectedStop(id), []);

  const clearPlan = useCallback(() => {
    request.current?.abort(); setRoute(null); setOrigin(null); setEnd(null); setPlan(null); setStops([]); setBusy(''); setError(''); setWarning(''); setMapsError(''); setSelectedStop(null); setAccess(null);
  }, []);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (params.destination) {
      // Apply a new destination delivered by an external Maps share or Shortcut.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearPlan(); setDestinationInput(params.destination); if (hydrated) setDestination(params.destination); destinationTouched.current = true;
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
  }, [car?.id, car?.mpg, car?.tankGallons, fuelType, refillPercent, priceQualifier, clearPlan]);

  async function pasteDestination() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) throw new Error('Copy a Maps destination link or address first.');
      clearPlan(); setDestinationInput(text.trim()); destinationTouched.current = true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not paste. You can type or paste into the destination field.'); }
  }

  async function loadStops(nextRoute: DriveRoute, initialRange: number, fullRange: number, signal: AbortSignal, forceSearch = false, excludedIds: string[] = []) {
    setAccess(null); setStops([]); setPlan(null); setWarning('');
    let completedStops = 0;
    const saved = stationsFromSavedLocations(receipts, priceReports);
    const lookup = async (window: StopWindow) => {
      if (signal.aborted) throw new Error('Trip changed.');
      setBusy(`Finding stop ${completedStops + 1} near mile ${Math.round(window.targetMiles)}…`);
      let found = saved;
      try {
        const mapped = await fetchStationsAlongRoute(driveRouteWindow(nextRoute, window.searchStartMiles, window.searchEndMiles), signal);
        found = [...new Map([...saved, ...mapped].map((station) => [station.id, station])).values()];
      } catch (cause) {
        if (signal.aborted || stationsOnRoute(saved, nextRoute.points, nextRoute.miles).length === 0) throw cause;
        setWarning('Public station search is unavailable. Only locations you saved on this device are being checked.');
      }
      if (signal.aborted) throw new Error('Trip changed.');
      return stationsOnRoute(withLocalPrices(found, receipts, priceReports, priceQualifier), nextRoute.points, nextRoute.miles).filter(station => !excludedIds.includes(station.id) && !useDriveStore.getState().avoidedStationIds.includes(station.id));
    };
    const result = await planDriveStops({ routeMiles: nextRoute.miles, initialRange, fullRange, fuelType, refillPercent, refillTargetPercent: Number(refillTarget), preferredIds: useDriveStore.getState().preferredStationIds, forceSearch, lookup, onProgress: (progress) => { completedStops = progress.length; if (!signal.aborted) setStops(progress); } });
    if (!signal.aborted) { setPlan(result); setStops(result.stops); setBusy(''); }
  }

  async function planTrip() {
    Keyboard.dismiss();
    clearPlan();
    const controller = new AbortController(); request.current = controller;
    try {
      if (!car) throw new Error('Add or select the car you’re driving.');
      if (!fuelRemaining.trim()) throw new Error('Choose a tank percentage or enter gallons left.');
      const estimate = fuelRange(car, Number(fuelRemaining), fuelUnit);
      if (!destinationInput.trim()) throw new Error('Enter a destination address, city or coordinates.');
      setBusy('Reading destination and finding your location…');
      const destination = await resolveMapsDestination(destinationInput, controller.signal);
      if (!await requestLocationPermission()) throw new Error('Allow location access to plan from your current position.');
      const start = await getCurrentLocation();
      if (controller.signal.aborted) return;
      setBusy('Finding the destination…');
      const destinationPoint = parseCoordinateDestination(destination) ?? await geocodeDestination(destination);
      if (controller.signal.aborted) return;
      setOrigin(start); setEnd(destinationPoint);
      setBusy('Finding the driving route…');
      const nextRoute = await fetchDriveRoute(start, destinationPoint, controller.signal);
      if (controller.signal.aborted) return;
      setDestination(destination); setDestinationInput(destination);
      setRoute(nextRoute);
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
  async function replan(excludedIds: string[] = []) {
    if (!route || !range) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try { await loadStops(route, range.initialRange, range.fullRange, controller.signal, true, excludedIds); }
    catch (cause) { if (!controller.signal.aborted) { setBusy(''); setError((cause as Error).message); } }
  }
  async function verifyAccess() {
    if (!origin || !end || !route || !range) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy('Checking road access and fuel legs…'); setAccess(null);
    try {
      const checked = await fetchDriveRoute(origin,end,controller.signal,stops.map(stop => stop.station));
      if (controller.signal.aborted) return;
      if (!checked.legMiles || checked.legMiles.length !== stops.length + 1) throw Error('The route service did not return every requested stop.');
      const result = reviewRoutedLegs(checked.legMiles,range.initialRange,range.fullRange,refillPercent,Number(refillTarget));
      setAccess({ points:checked.points, complete:result.complete, extraMiles:Math.max(0,checked.miles-route.miles), message:`Routed through all ${stops.length} stops: ${Math.round(checked.miles)} miles; ${Math.max(0,Math.round(checked.miles-route.miles))} added miles. ${result.complete ? 'Every routed leg fits the estimated safety range.' : 'At least one routed leg exceeds estimated safety range; change stops before driving.'} Smallest margin: ${Math.floor(Math.min(...result.rows.map(row => row.marginMiles)))} mi.` });
    } catch (cause) { if (!controller.signal.aborted) setAccess({complete:false,extraMiles:0,message:`Road access unverified: ${(cause as Error).message}`}); }
    finally { if (!controller.signal.aborted) setBusy(''); }
  }
  async function openMaps(url: string) { setMapsError(''); try { await Linking.openURL(url); } catch { setMapsError('Could not open Maps on this device.'); } }
  const googleSegments = end && (access ? access.complete : plan?.complete) ? googleMapsTripSegments(end, stops.map((stop) => stop.station)) : [];
  const modernAppleMaps = Platform.OS === 'ios' && Number.parseFloat(String(Platform.Version)) >= 18.4;

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headingRow}><Text style={styles.kicker}>GAS ON YOUR DRIVE</Text><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Settings</Text></Pressable></Link></View>
      <Text style={styles.title}>Where are you going?</Text>
      <Text style={styles.note}>Enter your destination, plan fuel stops, then open the trip in {mapsName}.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>1 · Destination</Text>
        <TextInput style={styles.input} value={destinationInput} onChangeText={(value) => { clearPlan(); setDestinationInput(value); destinationTouched.current = true; }} placeholder="Address, city or coordinates" accessibilityLabel="Trip destination" autoCorrect={false} returnKeyType="done" />
        <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void pasteDestination()}><Text style={styles.link}>Paste an address or Maps link</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => { try { saveDestination(destinationInput); } catch (cause) { setError((cause as Error).message); } }}><Text style={styles.link}>Save this destination</Text></Pressable>
        {destinations.map(value => <View key={value} style={styles.row}><Pressable accessibilityRole="button" style={styles.choice} onPress={() => { clearPlan(); setDestinationInput(value); destinationTouched.current = true; }}><Text style={styles.choiceText}>{value.slice(0,70)}</Text></Pressable><Pressable accessibilityRole="button" style={styles.textButton} onPress={() => removeDestination(value)}><Text style={styles.link}>Remove saved destination</Text></Pressable></View>)}
        {!!lastDestination && <Text style={styles.note}>Your last destination is remembered. You can change it above.</Text>}
      </View>
      <View style={styles.card}><Text style={styles.heading}>Refill target</Text><TextInput accessibilityLabel="Refill tank target percentage" keyboardType="number-pad" style={styles.input} value={refillTarget} onChangeText={value => { clearPlan(); setRefillTarget(value); }} /><Text style={styles.note}>Percent of tank after each refill; 100 is full. Keep at least 5% above the safety level. Partial refills require more stops.</Text><TextInput accessibilityLabel="Alternative fuel price for comparison" keyboardType="decimal-pad" placeholder="Optional comparison price per gallon" style={styles.input} value={alternativePrice} onChangeText={setAlternativePrice} />{!!avoidedStationIds.length && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => { avoidedStationIds.forEach(id => setStationPreference(id,'none')); clearPlan(); }}><Text style={styles.link}>Clear {avoidedStationIds.length} avoided stations</Text></Pressable>}</View>
      <View style={styles.card}>
        <View style={styles.headingRow}><Text style={styles.heading}>2 · What are you driving?</Text><Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Manage cars</Text></Pressable></Link></View>
        <View style={styles.row}>{cars.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === car?.id }} onPress={() => { clearPlan(); selectCar(item.id); }} style={[styles.choice, item.id === car?.id && styles.selected]}><Text style={[styles.choiceText, item.id === car?.id && styles.selectedText]}>{item.name}</Text></Pressable>)}
          <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.choice}><Text style={styles.choiceText}>+ Add car</Text></Pressable></Link></View>
        {car && <Text style={styles.note}>{car.mpg} MPG · {car.tankGallons} US gal tank · editable estimates</Text>}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>3 · How full is the tank?</Text>
        <View style={styles.row}>{(['percent', 'gallons'] as const).map((unit) => <Pressable key={unit} accessibilityRole="button" accessibilityState={{ selected: fuelUnit === unit }} style={[styles.choice, fuelUnit === unit && styles.selected]} onPress={() => { clearPlan(); setFuelRemaining(''); setFuelUnit(unit); }}><Text style={[styles.choiceText, fuelUnit === unit && styles.selectedText]}>{unit === 'percent' ? 'Percent left' : 'Gallons left'}</Text></Pressable>)}</View>
        {fuelUnit === 'percent' && <View style={styles.row}>{[10, 25, 50, 75, 100].map((percent) => <Pressable key={percent} accessibilityRole="button" accessibilityLabel={`${percent} percent of tank left`} accessibilityState={{ selected: fuelRemaining === String(percent) }} onPress={() => { clearPlan(); setFuelRemaining(String(percent)); }} style={[styles.choice, fuelRemaining === String(percent) && styles.selected]}><Text style={[styles.choiceText, fuelRemaining === String(percent) && styles.selectedText]}>{percent}%</Text></Pressable>)}</View>}
        <TextInput style={styles.input} value={fuelRemaining} onChangeText={(value) => { clearPlan(); setFuelRemaining(value); }} placeholder={fuelUnit === 'percent' ? 'Or enter a percentage' : 'US gallons remaining'} accessibilityLabel={fuelUnit === 'percent' ? 'Tank percentage left' : 'US gallons left in tank'} keyboardType="decimal-pad" />
        {range && <Text style={styles.range}>~{Math.floor(safeRange(range.initialRange, range.fullRange, refillPercent))} mi until your refill level · ~{range.gallons.toFixed(1)} gal</Text>}
        <Text style={styles.note}>Refill at {refillPercent}% left · change this in Settings. Range uses your saved car estimates and a 15% reduction. Check your tank size in Manage cars before using percent.</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={!!busy || !hydrated} style={[styles.primary, !!busy && styles.disabled]} onPress={() => void planTrip()}><Text style={styles.primaryText}>{busy ? 'Planning…' : 'Plan fuel stops'}</Text></Pressable>
      {!!busy && <View style={styles.status}><ActivityIndicator color={colors.accentDark} /><Text style={styles.note}>{busy}</Text><Pressable accessibilityRole="button" style={styles.textButton} onPress={clearPlan}><Text style={styles.link}>Cancel</Text></Pressable></View>}
      {!!error && <Text style={styles.error}>{error}{stops.length ? ' Stops shown so far do not cover the full trip.' : ''}</Text>}
      {!!error && end && !route && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(mapsApp === 'apple' ? appleMapsDirections(end) : googleMapsDirections(end))}><Text style={styles.link}>Open destination in {mapsName} without a fuel plan ↗</Text></Pressable>}
      {route && <>
        <View style={styles.summary}><Text style={styles.heading}>{Math.round(route.miles)} mi · ~{(route.minutes / 60).toFixed(1)} hr</Text>
          <Text style={styles.note}>{plan ? plan.complete ? plan.needsFuel ? `${stops.length} fuel stop${stops.length === 1 ? '' : 's'} planned. Refill to full at each stop. Target: ${refillPercent}% left.` : stops.length ? 'Optional fuel stop. Your estimated fuel reaches the destination above your refill level.' : 'Your estimated fuel reaches the destination above your refill level.' : 'Building the fuel plan…' : busy ? 'Stops will appear as they are found.' : 'Fuel plan unavailable. Replan before driving.'}</Text>
          {!!error && !busy && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void searchAnyway()}><Text style={styles.link}>Retry gas station search</Text></Pressable>}
          {plan?.reason && <Text style={styles.error}>{plan.reason} Check Maps or refuel earlier before driving.</Text>}
          {plan?.complete && !plan.needsFuel && stops.length === 0 && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void searchAnyway()}><Text style={styles.link}>Find gas on this trip anyway</Text></Pressable>}
        </View>
        {end && (access ? access.complete : plan?.complete) && <View style={styles.card}><Text style={styles.heading}>Ready for {mapsName}?</Text>
          {mapsApp === 'apple' && modernAppleMaps && <Pressable accessibilityRole="button" style={styles.primary} onPress={() => void openMaps(appleMapsTrip(end, stops.map((stop) => stop.station)))}><Text style={styles.primaryText}>Open trip in Apple Maps ↗</Text></Pressable>}
          {mapsApp === 'apple' && !modernAppleMaps && (stops.length === 0 ? <Pressable accessibilityRole="button" style={styles.primary} onPress={() => void openMaps(appleMapsDirections(end))}><Text style={styles.primaryText}>Open destination in Apple Maps ↗</Text></Pressable> : <Text style={styles.note}>All-stop Apple Maps links require iOS 18.4+. Use each stop’s directions below on this iPhone.</Text>)}
          {mapsApp === 'google' && googleSegments.map((segment, index) => <Pressable key={segment.url} accessibilityRole="button" style={styles.primary} onPress={() => void openMaps(segment.url)}><Text style={styles.primaryText}>{googleSegments.length > 1 ? `Google Maps · part ${index + 1}/${googleSegments.length}${segment.firstStop <= segment.lastStop ? ` · stops ${segment.firstStop}–${segment.lastStop}` : ''}${segment.reachesDestination ? ' + destination' : ''}` : `Google Maps · ${stops.length} stops + destination`} ↗</Text></Pressable>)}
          {mapsApp === 'google' && googleSegments.length > 1 && <Text style={styles.note}>Google mobile links limit waypoints. All stops are kept in these parts; open the next part after finishing the previous one.</Text>}
        </View>}
        <View style={styles.mapFrame}><StationMap pins={mapPins} center={origin} route={mapRoute} selectedId={selectedStop} onSelect={selectPin} dom={{ useExpoDOMWebView: false, style: { height: 370 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} /></View>
        {!!warning && <Text style={styles.error}>{warning}</Text>}
        {stops.map(({ station, legMiles }, index) => {
          const price = station.prices.find((item) => item.fuelType === fuelType && item.source !== 'sample');
          return <View key={station.id} style={[styles.card, selectedStop === station.id && styles.stopSelected]}>
            <Text style={styles.kicker}>STOP {index + 1} · REFILL TO {refillTarget}%</Text>
            <View style={styles.headingRow}><Text style={styles.heading}>{station.name}</Text><Text style={styles.price}>{price ? formatFuelPrice(price.price) : 'Unknown price'}</Text></View>
            <Text style={styles.note}>Mile {Math.round(station.milesAhead)} · ~{Math.round(legMiles)} mi this leg · ~{station.milesOffRoute.toFixed(1)} mi off route</Text>
            <Text style={styles.note}>{station.address}{price ? ` · ${priceDescription(price, false)}` : ` · no saved ${fuelType} price`}</Text>
            <View style={styles.row}><Pressable accessibilityRole="button" disabled={!!busy} style={styles.choice} onPress={() => void replan([station.id])}><Text style={styles.choiceText}>Swap stop</Text></Pressable><Pressable accessibilityRole="button" disabled={!!busy} style={styles.choice} onPress={() => { setStops(current => current.filter(item => item.station.id !== station.id)); setPlan(current => current ? {...current,complete:false,reason:'Stop removed. Verify road access and fuel range before using this edited trip.'} : current); setAccess(null); }}><Text style={styles.choiceText}>Remove stop</Text></Pressable><Pressable accessibilityRole="button" style={styles.choice} onPress={() => setStationPreference(station.id,preferredStationIds.includes(station.id) ? 'none' : 'prefer')}><Text style={styles.choiceText}>{preferredStationIds.includes(station.id) ? 'Unprefer' : 'Prefer station'}</Text></Pressable><Pressable accessibilityRole="button" disabled={!!busy} style={styles.choice} onPress={() => { setStationPreference(station.id,'avoid'); void replan(); }}><Text style={styles.choiceText}>Avoid & replan</Text></Pressable></View>
            <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void openMaps(mapsApp === 'apple' ? appleMapsDirections(station) : googleMapsDirections(station))}><Text style={styles.link}>To this stop · {mapsName} ↗</Text></Pressable>
          </View>;
        })}
        <View style={styles.card}><Pressable accessibilityRole="button" disabled={!!busy} style={styles.primary} onPress={() => void verifyAccess()}><Text style={styles.primaryText}>Check road access & routed fuel range</Text></Pressable>{access && <><Text style={access.complete ? styles.note : styles.error}>{access.message}</Text>{access.complete && <Text style={styles.note}>Routing checks roads, not opening hours, pump access or current conditions. Verify in Maps.</Text>}{(() => { const prices = stops.map(stop => stop.station.prices.find(price => price.fuelType === fuelType && isRecentPrice(price,priceCheckedAt))?.price); const unitPrice = prices.length && prices.every((price): price is number => price !== undefined) ? prices.reduce((sum,price) => sum+price!,0)/prices.length : 0; const economics = car && range && access.complete ? detourEconomics(access.extraMiles,car.mpg,unitPrice,Math.max(0,route.miles/(car.mpg*.85)-range.gallons),Number(alternativePrice)) : null; return economics ? <Text style={styles.note}>Estimated detour fuel: {formatMoney(economics.detourCents)}. Price savings before detour: {formatMoney(economics.priceSavingsCents)}. Net: {formatMoney(economics.netCents)}. Uses average recent selected-stop prices, your comparison price and car MPG with 15% range allowance; time costs excluded.</Text> : <Text style={styles.note}>Savings comparison needs recent prices for every selected stop, a comparison price, and a verified trip requiring fuel.</Text>; })()}</>}</View>
        {!!mapsError && <Text style={styles.error}>{mapsError}</Text>}
        <Text style={styles.note}>Stops favor nearby saved prices around each refill point; without reports, distance decides. Prices and range are estimates. Station proximity is measured from the route, not verified road access. Confirm exits, opening hours and fuel level in Maps. Routing: OSRM / FOSSGIS · stations/map: © OpenStreetMap contributors.</Text>
      </>}
      <Text style={styles.note}>Planning sends trip coordinates to public routing and station services. Maps may choose different roads.</Text>
      <Pressable accessibilityRole="link" style={styles.textButton} onPress={() => void Linking.openURL('https://www.openstreetmap.org/fixthemap')}><Text style={styles.link}>Fix the map · OpenStreetMap ↗</Text></Pressable>
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
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, range: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: colors.ink, borderRadius: 7, alignItems: 'center', justifyContent: 'center', minHeight: 50 }, primaryText: { color: colors.surface, fontWeight: '800' }, disabled: { opacity: 0.6 },
  textButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.accentDark, fontSize: 12, fontWeight: '800' }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  status: { backgroundColor: colors.surface, borderRadius: 9, padding: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  summary: { backgroundColor: colors.paleGreen, borderRadius: 9, padding: 16, gap: 8 }, mapFrame: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden' },
  stopSelected: { borderColor: colors.accentDark, borderWidth: 2 }, price: { color: colors.accentDark, fontSize: 15, fontWeight: '800' },
});
