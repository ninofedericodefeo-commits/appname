import { useSystemAccessibility } from '@/features/accessibility/systemPreferences';
import { themedStyles, useThemeRevision, isDarkTheme, colors } from '@/theme';
import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { ScreenSafeArea as SafeAreaView } from '@/components/ScreenSafeArea';

import { GasStationCard } from '@/components/GasStationCard';
import { AppIcon } from '@/components/AppIcon';
import { PageToolbar } from '@/components/SettingsButton';
import MyCarsSection from '@/features/vehicles/MyCarsSection';
import AreaSearchSheet from '@/features/location/AreaSearchSheet';
import { coordinateLabel } from '@/features/location/areaSearch';
import type { SearchArea } from '@/features/location/areaSearch';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import StationMap from '@/components/StationMap';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { stationApiBaseUrl } from '@/features/stations/data';
import { useNearbyStations } from '@/features/stations/hooks';
import { filterNamedStations, filterPricedStations, isRecentPrice, prepareStations, recentStationPrice } from '@/features/stations/logic';
import { priceQualifiers } from '@/features/fuel/logic';
import { withLocalPrices, stationsFromSavedLocations } from '@/features/stations/localPrices';
import { useSettingsStore } from '@/stores/settingsStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import type { FuelType } from '@/types/stations';
import SampleDataControl from '@/features/samples/SampleDataControl';
import SampleStationsPreview from '@/features/samples/SampleStationsPreview';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function GasScreen() {
  useThemeRevision();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.4;
  const { selectedFuelType, selectedRadius, sortOrder, hideUnpricedStations, hideUnnamedStations, setHideUnnamedStations, recentPricesOnly, priceQualifier, setRecentPricesOnly, setPriceQualifier, setHideUnpricedStations, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [mode, setMode] = useState<'nearby' | 'online'>('nearby');
  const savedView = useSettingsStore(state => state.gasView);
  const preferList = useSettingsStore(state => state.preferStationList);
  const screenReader = useSystemAccessibility(state => state.screenReader);
  const listPreferenceKey = `${preferList}-${screenReader}`;
  const [mapOverride,setMapOverride] = useState('');
  const viewMode = (preferList || screenReader) && mapOverride !== listPreferenceKey ? 'list' : savedView;
  const setViewMode = (gasView: 'map' | 'list') => { setMapOverride(gasView === 'map' ? listPreferenceKey : ''); useSettingsStore.getState().configure({ gasView }); };
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const receiptReports = useReceiptStore((state) => state.reports);
  const priceReports = usePriceReportStore((state) => state.reports);
  const receiptCount = receiptReports.filter(report => !report.trashedAt).length + priceReports.filter(report => !report.trashedAt).length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const location = useGasSearchStore(state => state.lastArea);
  const ready = useSyncExternalStore(useGasSearchStore.persist.onFinishHydration, useGasSearchStore.persist.hasHydrated, () => false);
  const [areaSearchOpen, setAreaSearchOpen] = useState(false);
  const locationRequest = useRef(0);
  const invalidateLocation = useCallback(() => { locationRequest.current++; }, []);
  useEffect(() => invalidateLocation, [invalidateLocation]);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'unavailable'>('idle');
  const initialSearchStarted = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const chooseArea = useCallback((area: SearchArea) => {
    invalidateLocation(); setLocationStatus('idle'); setSelectedStationId(null);
    useGasSearchStore.getState().chooseArea(area);
  }, [invalidateLocation]);
  const searchMapArea = useCallback(async (point: { latitude: number; longitude: number }) => {
    chooseArea({ ...point, label: `Map area · ${coordinateLabel(point)}`, kind: 'map' });
  }, [chooseArea]);
  const startLocationSearch = useCallback(async () => {
    const request = ++locationRequest.current;
    setLocationStatus('loading');
    try {
      if (Platform.OS !== 'web' && !await requestLocationPermission()) {
        if (request === locationRequest.current) setLocationStatus('denied');
        return;
      }
      const current = await getCurrentLocation();
      if (request !== locationRequest.current) return;
      chooseArea({ ...current, kind: 'gps', label: `GPS check ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` });
    } catch {
      if (request === locationRequest.current) setLocationStatus('unavailable');
    }
  }, [chooseArea]);
  useEffect(() => {
    if (!ready || initialSearchStarted.current) return;
    let canceled = false;
    void Promise.resolve().then(() => {
      if (canceled || initialSearchStarted.current) return;
      initialSearchStarted.current = true;
      if (!useGasSearchStore.getState().lastArea) return startLocationSearch();
    });
    return () => { canceled = true; };
  }, [ready, startLocationSearch]);

  const { data, isLoading, isFetching, isError, isPartial, expansionFailed, error: searchError, refetch, isCached, fetchedAt, refreshFailed, coveredRadius } = useNearbyStations({
    mode,
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });
  const allStations = useMemo(() => {
    const found = [...new Map([...stationsFromSavedLocations(receiptReports, priceReports), ...(data?.stations ?? [])].map(station => [station.id, station])).values()];
    if (!location) return found;
    return prepareStations(withLocalPrices(found, receiptReports, priceReports, priceQualifier), { ...location, radius: selectedRadius, fuelType: selectedFuelType, sortOrder }, now);
  }, [data?.stations, location, receiptReports, priceReports, selectedRadius, selectedFuelType, sortOrder, priceQualifier, now]);
  const stations = useMemo(() => filterNamedStations(filterPricedStations(allStations, selectedFuelType, hideUnpricedStations, recentPricesOnly, now), hideUnnamedStations), [allStations, selectedFuelType, hideUnpricedStations, hideUnnamedStations, recentPricesOnly, now]);
  const cheapest = stations.reduce<(typeof stations)[number] | undefined>((best, station) => {
    const price = recentStationPrice(station, selectedFuelType, now);
    const bestPrice = best ? recentStationPrice(best, selectedFuelType, now) : Infinity;
    return Number.isFinite(price) && price < bestPrice ? station : best;
  }, undefined);
  const canShowResults = location !== null;
  const selectedStation = stations.find((station) => station.id === selectedStationId);
  const mapPins = useMemo(() => stations.map((station) => ({
    id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude,
    price: station.prices.find((price) => price.fuelType === selectedFuelType)?.price ?? null, sample: false, lowest: station.id === cheapest?.id,
    stale: !!station.prices.find(price => price.fuelType === selectedFuelType) && !isRecentPrice(station.prices.find(price => price.fuelType === selectedFuelType), now),
  })), [stations, selectedFuelType, now, cheapest?.id]);
  const selectPin = useCallback(async (id: string) => setSelectedStationId(id), []);

  const filterCount = Number(selectedRadius !== 5) + Number(sortOrder !== 'price') + Number(priceQualifier !== 'standard') + Number(recentPricesOnly) + Number(hideUnpricedStations) + Number(hideUnnamedStations) + Number(mode !== 'nearby');
  const fuelLabel = selectedFuelType.charAt(0).toUpperCase() + selectedFuelType.slice(1);
  const searching = canShowResults && (isLoading || isFetching);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageToolbar maxWidth={1120} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, fontScale >= 1.4 && styles.largeTextTitle]}>Gas stations</Text>
            <Text style={styles.headerNote}>Compare nearby fuel prices.</Text>
          </View>
          {fontScale < 1.4 && <Link href="/report-price" asChild><Pressable accessibilityRole="button" accessibilityLabel="Report a price or refill" style={styles.addButton}><AppIcon name="plus" color={colors.primary} size={24} /></Pressable></Link>}
        </View>

        <View style={styles.searchBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={location ? `Change search area, currently ${location.label}` : 'Search a city, ZIP or address'} accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => setAreaSearchOpen(true)} style={({ pressed }) => [styles.searchControl, pressed && styles.pressed]}>
            <AppIcon name="search" color={colors.muted} size={21} />
            <View style={styles.searchCopy}><Text style={styles.searchLabel}>{location ? 'Search near' : 'Where are you headed?'}</Text><Text style={styles.areaName}>{location?.label ?? 'City, ZIP or address'}</Text></View>
            <AppIcon name="chevron-down" color={colors.muted} size={16} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Use current location" accessibilityState={{ disabled: !ready || locationStatus === 'loading', busy: locationStatus === 'loading' }} disabled={!ready || locationStatus === 'loading'} onPress={() => void startLocationSearch()} style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
            {locationStatus === 'loading' ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="location" color={colors.primary} size={22} />}
          </Pressable>
        </View>

        <View accessibilityLabel="Fuel type" style={styles.fuelControl}>
          {fuelOptions.map(fuel => <Pressable key={fuel} accessibilityRole="button" accessibilityState={{ selected: selectedFuelType === fuel }} onPress={() => setSelectedFuelType(fuel)} style={({ pressed }) => [styles.fuelOption, (width < 360 || fontScale > 1.2) && styles.fuelOptionNarrow, selectedFuelType === fuel && styles.selectedFuel, pressed && styles.pressed]}>
            <Text style={[styles.fuelText, selectedFuelType === fuel && styles.selectedFuelText]}>{fuel.charAt(0).toUpperCase() + fuel.slice(1)}</Text>
          </Pressable>)}
        </View>

        <View style={styles.filterBar}>
          <Text style={styles.filterSummary}>Within {selectedRadius} mi · {sortOrder === 'price' ? 'Lowest price' : 'Nearest first'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filters${filterCount ? `, ${filterCount} changed` : ''}`} accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={({ pressed }) => [styles.filterButton, filtersOpen && styles.filterButtonActive, pressed && styles.pressed]}>
            <AppIcon name="sliders" color={colors.primary} size={18} /><Text style={styles.filterButtonText}>Filters{filterCount ? ` (${filterCount})` : ''}</Text>
          </Pressable>
        </View>

        {filtersOpen && <View style={styles.filters}>
          <View style={styles.filterHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Search filters</Text><SubscriptionButton label="Reset" onPress={() => { setSelectedRadius(5); setSortOrder('price'); setHideUnpricedStations(false); setHideUnnamedStations(false); setRecentPricesOnly(false); setPriceQualifier('standard'); setMode('nearby'); }} /></View>
          <Text style={styles.fieldLabel}>Price type</Text>
          <View style={styles.pillRow}>{priceQualifiers.map(value => <Pressable key={value.id} accessibilityRole="button" accessibilityState={{ selected: priceQualifier === value.id }} style={[styles.pill, priceQualifier === value.id && styles.activePill]} onPress={() => setPriceQualifier(value.id)}><Text style={[styles.pillText, priceQualifier === value.id && styles.activePillText]}>{value.label}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Distance</Text>
          <View style={styles.pillRow}>{[5, 10, 25].map(radius => <Pressable key={radius} accessibilityRole="button" accessibilityState={{ selected: selectedRadius === radius }} style={[styles.pill, selectedRadius === radius && styles.activePill]} onPress={() => setSelectedRadius(radius)}><Text style={[styles.pillText, selectedRadius === radius && styles.activePillText]}>{radius} mi</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Sort by</Text>
          <View style={styles.pillRow}>{(['price', 'distance'] as const).map(sort => <Pressable key={sort} accessibilityRole="button" accessibilityState={{ selected: sortOrder === sort }} style={[styles.pill, sortOrder === sort && styles.activePill]} onPress={() => setSortOrder(sort)}><Text style={[styles.pillText, sortOrder === sort && styles.activePillText]}>{sort === 'price' ? 'Lowest price' : 'Distance'}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Recent prices only" accessibilityState={{ checked: recentPricesOnly }} aria-checked={recentPricesOnly} onPress={() => setRecentPricesOnly(!recentPricesOnly)} style={styles.checkRow}><View style={styles.checkCopy}><Text style={styles.checkTitle}>Recent prices only</Text><Text style={styles.checkNote}>Reported in the last 24 hours</Text></View><View style={[styles.checkbox, recentPricesOnly && styles.checked]}>{recentPricesOnly && <AppIcon name="check" size={16} color={colors.surface} />}</View></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Hide stations without a price" accessibilityState={{ checked: hideUnpricedStations }} aria-checked={hideUnpricedStations} onPress={() => setHideUnpricedStations(!hideUnpricedStations)} style={styles.checkRow}><Text style={[styles.checkTitle, styles.checkCopy]}>Hide stations without a price</Text><View style={[styles.checkbox, hideUnpricedStations && styles.checked]}>{hideUnpricedStations && <AppIcon name="check" size={16} color={colors.surface} />}</View></Pressable>
          {!!stationApiBaseUrl && <><Text style={styles.fieldLabel}>Station source</Text><View style={styles.pillRow}>{(['nearby', 'online'] as const).map(source => <Pressable key={source} accessibilityRole="button" accessibilityState={{ selected: mode === source }} style={[styles.pill, mode === source && styles.activePill]} onPress={() => { setMode(source); if (source === 'online') setViewMode('list'); }}><Text style={[styles.pillText, mode === source && styles.activePillText]}>{source === 'nearby' ? 'OpenStreetMap' : 'Google prices'}</Text></Pressable>)}</View></>}
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Hide stations without a name" accessibilityState={{ checked: hideUnnamedStations }} aria-checked={hideUnnamedStations} onPress={() => setHideUnnamedStations(!hideUnnamedStations)} style={styles.checkRow}><Text style={[styles.checkTitle, styles.checkCopy]}>Hide stations without a name</Text><View style={[styles.checkbox, hideUnnamedStations && styles.checked]}>{hideUnnamedStations && <AppIcon name="check" size={16} color={colors.surface} />}</View></Pressable>
          <Text style={styles.footnote}>Filters apply to {fuelLabel.toLowerCase()} prices in both views.</Text>
          <SubscriptionButton label="Show results" tone="primary" onPress={() => setFiltersOpen(false)} />
        </View>}

        <View style={[styles.body, wide && styles.wideBody]}>
          <View style={styles.results}>
            <SampleStationsPreview fuelType={selectedFuelType} />
            <View style={styles.resultsHeading}>
              <View style={styles.resultsCopy}><Text accessibilityRole="header" style={styles.sectionTitle}>{canShowResults ? 'Nearby stations' : 'Find stations'}</Text><Text accessibilityLiveRegion="polite" style={styles.resultCount}>{!canShowResults ? 'Choose an area to get started' : searching && !stations.length ? 'Searching…' : `${stations.length} station${stations.length === 1 ? '' : 's'} · ${fuelLabel}`}</Text></View>
              <View style={styles.viewToggle}>{(['map', 'list'] as const).map(view => <Pressable key={view} accessibilityRole="button" accessibilityLabel={view === 'map' ? 'Map view' : 'List view'} aria-pressed={viewMode === view} accessibilityState={{ selected: viewMode === view, disabled: mode === 'online' && view === 'map' }} disabled={mode === 'online' && view === 'map'} onPress={() => setViewMode(view)} style={[styles.viewButton, viewMode === view && styles.selectedView, mode === 'online' && view === 'map' && styles.disabled]}><AppIcon name={view} color={viewMode === view ? colors.ink : colors.muted} size={18} /><Text style={[styles.viewText, viewMode === view && styles.selectedViewText]}>{view === 'map' ? 'Map' : 'List'}</Text></Pressable>)}</View>
            </View>

            {(locationStatus === 'denied' || locationStatus === 'unavailable') && <View style={styles.statusBox}><Text style={styles.statusTitle}>{locationStatus === 'denied' ? 'Location access is off' : 'Location unavailable'}</Text><Text style={styles.statusText}>{location ? 'Your selected area is still in use. ' : ''}Search by city or ZIP to find stations.</Text></View>}
            {(locationStatus === 'loading' || searching) && <View accessibilityLiveRegion="polite" style={styles.loadingBox}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>{locationStatus === 'loading' ? 'Finding your location…' : isCached ? 'Refreshing saved stations…' : isPartial ? `Searching beyond ${coveredRadius} mi…` : 'Finding stations…'}</Text></View>}
            {canShowResults && isCached && <View style={styles.cacheNotice}><Text style={styles.footnote}>{refreshFailed ? 'Refresh unavailable. ' : ''}Saved results{fetchedAt ? ` from ${new Date(fetchedAt).toLocaleString()}` : ''}{coveredRadius < selectedRadius ? ` · within ${coveredRadius} mi` : ''}. Price dates have not changed.</Text>{refreshFailed && <SubscriptionButton label="Retry" onPress={() => void refetch()} />}</View>}
            {canShowResults && expansionFailed && <Text style={styles.footnote}>Wider search unavailable. Showing stations within {coveredRadius} mi.</Text>}
            {canShowResults && isError && <View style={styles.statusBox}><Text style={styles.statusTitle}>Station search unavailable</Text><Text style={styles.statusText}>{searchError instanceof Error ? searchError.message : 'Check your connection and try again.'} Saved report locations can still appear.</Text><SubscriptionButton label="Retry search" onPress={() => void refetch()} /></View>}
            {mode === 'online' && <Text style={styles.footnote}>Google prices are shown in List. Switch the station source in Filters to use the map.</Text>}

            {!canShowResults && viewMode === 'list' && locationStatus !== 'loading' && <View style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="fuel" size={32} color={colors.primary} /></View><Text style={styles.emptyTitle}>Start with a location</Text><Text style={styles.emptyText}>Search an area or use your current location to see nearby gas stations.</Text><SubscriptionButton label="Search an area" tone="primary" disabled={!ready} onPress={() => setAreaSearchOpen(true)} /></View>}
            {canShowResults && !isLoading && !isFetching && !isError && stations.length === 0 && <View style={styles.emptyCard}><AppIcon name="search" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>{(hideUnpricedStations || recentPricesOnly || hideUnnamedStations) && allStations.length > 0 ? 'No matching stations' : 'No stations found'}</Text><Text style={styles.emptyText}>{(hideUnpricedStations || recentPricesOnly || hideUnnamedStations) && allStations.length > 0 ? 'Try including unnamed stations, older prices or stations without a price.' : `Try a wider radius or another search area.`}</Text>{(hideUnpricedStations || recentPricesOnly || hideUnnamedStations) && allStations.length > 0 ? <SubscriptionButton label="Show all stations" onPress={() => { setHideUnpricedStations(false); setHideUnnamedStations(false); setRecentPricesOnly(false); }} /> : <SubscriptionButton label="Adjust filters" onPress={() => setFiltersOpen(true)} />}</View>}

            {viewMode === 'map' && <>
              <View style={styles.mapFrame}><StationMap key={`${mode}-${selectedRadius}`} dark={isDarkTheme()} height={wide ? 450 : 340} pins={mapPins} center={location} centerLabel="Search center" onSearchArea={searchMapArea} selectedId={selectedStationId} onSelect={selectPin} dom={{ useExpoDOMWebView: false, style: { height: wide ? 450 : 340 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} /></View>
              {selectedStation ? <GasStationCard key={selectedStation.id} station={selectedStation} fuelType={selectedFuelType} isCheapest={selectedStation.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt canFavorite={mode === 'nearby'} distanceLabel="from search center" onReported={() => void refetch()} /> : <Text style={styles.footnote}>Select a station for directions and price details.</Text>}
            </>}
            {viewMode === 'list' && canShowResults && !isLoading && stations.length > 0 && <View style={styles.listSection}>
              {mode === 'online' && data?.provider === 'Google Maps' && <Image source={require('../../../assets/google-maps-logo.png')} style={styles.googleLogo} accessibilityLabel="Google Maps" />}
              {!cheapest && <Text style={styles.footnote}>No recent {selectedFuelType} prices. Older reports may appear below.</Text>}
              {stations.map(station => <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={station.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt canFavorite={mode === 'nearby'} distanceLabel="from search center" onReported={() => void refetch()} />)}
            </View>}
            {canShowResults && <Text style={styles.sourceNote}>Distances are from your search center. Reported prices are unverified.{mode === 'nearby' ? ' Station locations © OpenStreetMap contributors.' : ''}</Text>}
          </View>

          <View style={[styles.tools, wide && styles.wideTools]}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Your next fill-up</Text>
            <View style={styles.actionGroup}>
              <Link href="/on-route" asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.actionRow, styles.rowDivider])}><View style={styles.actionIcon}><AppIcon name="route" color={colors.primary} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Plan a drive</Text><Text style={styles.actionNote}>Find fuel stops along your route</Text></View><AppIcon name="chevron-right" size={17} color={colors.muted} /></Pressable></Link>
              <Link href="/report-price" asChild><Pressable accessibilityRole="button" style={styles.actionRow}><View style={styles.actionIcon}><AppIcon name="plus" color={colors.primary} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Report a price or refill</Text><Text style={styles.actionNote}>Save what you paid at the pump</Text></View><AppIcon name="chevron-right" size={17} color={colors.muted} /></Pressable></Link>
            </View>
            <MyCarsSection />
            <Link href="/report-receipt" asChild><Pressable accessibilityRole="button" style={styles.receiptCard}><View style={styles.actionIcon}><AppIcon name="receipt" color={colors.primary} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Reports & receipts</Text><Text style={styles.actionNote}>{receiptCount ? `${receiptCount} saved report${receiptCount === 1 ? '' : 's'}` : 'Your saved prices and fill-ups'}</Text></View><AppIcon name="chevron-right" size={17} color={colors.muted} /></Pressable></Link>
          </View>
        </View>
        <View style={styles.sampleControl}><SampleDataControl compact /></View>
      </ScrollView>
      {areaSearchOpen && <AreaSearchSheet onChoose={chooseArea} onClose={() => setAreaSearchOpen(false)} />}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1 },
  sampleControl: { marginBottom: 16 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerCopy: { flex: 1 },
  title: { fontSize: 34, lineHeight: 41, letterSpacing: -1.1, fontWeight: '700', color: colors.ink },
  largeTextTitle: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  headerNote: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 4 },
  addButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, marginBottom: 16 },
  searchControl: { flex: 1, minHeight: 68, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchCopy: { flex: 1, gap: 3 },
  searchLabel: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  areaName: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  locationButton: { minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.line, marginRight: 4 },
  fuelControl: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.line },
  fuelOption: { flexGrow: 1, flexBasis: '20%', minHeight: 44, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  fuelOptionNarrow: { flexBasis: '40%' },
  selectedFuel: { backgroundColor: colors.surface },
  fuelText: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  selectedFuelText: { color: colors.ink, fontWeight: '600' },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 4, marginBottom: 14 },
  filterSummary: { color: colors.muted, fontSize: 13, lineHeight: 19, flexShrink: 1, paddingVertical: 8 },
  filterButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10 },
  filterButtonActive: { backgroundColor: colors.surface },
  filterButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  filters: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, gap: 12, marginBottom: 24 },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.paper },
  activePill: { backgroundColor: colors.primary },
  pillText: { color: colors.inkSoft, fontSize: 14, fontWeight: '500' },
  activePillText: { color: colors.surface, fontWeight: '600' },
  checkRow: { minHeight: 56, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line },
  checkCopy: { flex: 1 },
  checkTitle: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  checkNote: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  body: { gap: 28 }, wideBody: { flexDirection: 'row', alignItems: 'flex-start' },
  results: { flex: 1, minWidth: 0 },
  resultsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  resultsCopy: { flexGrow: 1, flexShrink: 1 },
  sectionTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  resultCount: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  viewToggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.line, gap: 2 },
  viewButton: { flexDirection: 'row', minHeight: 44, minWidth: 66, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 9 },
  selectedView: { backgroundColor: colors.surface }, viewText: { color: colors.muted, fontSize: 13, fontWeight: '500' }, selectedViewText: { color: colors.ink, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  statusBox: { padding: 16, borderRadius: 14, backgroundColor: colors.paleOrange, gap: 6, marginBottom: 14 },
  statusTitle: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '600' }, statusText: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  loadingBox: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 16 }, loadingText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 21 },
  cacheNotice: { gap: 4, marginBottom: 12 },
  mapFrame: { borderRadius: 18, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  listSection: { gap: 2 }, googleLogo: { width: 98, height: 18, marginVertical: 10 },
  footnote: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  sourceNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 14, marginBottom: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 330 },
  tools: { gap: 14 }, wideTools: { width: 310 },
  actionGroup: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  actionRow: { minHeight: 80, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  actionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, gap: 4 }, actionTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '600' }, actionNote: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  receiptCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80 },
  pressed: { opacity: 0.6 },
}));
