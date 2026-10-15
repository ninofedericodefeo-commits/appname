import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
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
import { filterPricedStations, isRecentPrice, prepareStations, recentStationPrice } from '@/features/stations/logic';
import { priceQualifiers } from '@/features/fuel/logic';
import { withLocalPrices, stationsFromSavedLocations } from '@/features/stations/localPrices';
import { useSettingsStore } from '@/stores/settingsStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, hideUnpricedStations, recentPricesOnly, priceQualifier, setRecentPricesOnly, setPriceQualifier, setHideUnpricedStations, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [mode, setMode] = useState<'nearby' | 'online'>('nearby');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
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
  const stations = useMemo(() => filterPricedStations(allStations, selectedFuelType, hideUnpricedStations, recentPricesOnly, now), [allStations, selectedFuelType, hideUnpricedStations, recentPricesOnly, now]);
  const cheapest = stations.reduce<(typeof stations)[number] | undefined>((best, station) => {
    const price = recentStationPrice(station, selectedFuelType, now);
    const bestPrice = best ? recentStationPrice(best, selectedFuelType, now) : Infinity;
    return Number.isFinite(price) && price < bestPrice ? station : best;
  }, undefined);
  const canShowResults = location !== null;
  const selectedStation = stations.find((station) => station.id === selectedStationId);
  const mapPins = useMemo(() => stations.map((station) => ({
    id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude,
    price: station.prices.find((price) => price.fuelType === selectedFuelType)?.price ?? null, sample: false,
    stale: !!station.prices.find(price => price.fuelType === selectedFuelType) && !isRecentPrice(station.prices.find(price => price.fuelType === selectedFuelType), now),
  })), [stations, selectedFuelType, now]);
  const selectPin = useCallback(async (id: string) => setSelectedStationId(id), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <PageToolbar />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Gas stations</Text>
          <Text style={styles.headerNote}>Find nearby stations and record prices you see.</Text>
        </View>

        <View style={styles.areaCard}>
          <Text style={styles.areaLabel}>SEARCH NEAR</Text>
          <Text numberOfLines={2} style={styles.areaName}>{location?.label ?? 'Choose a search area'}</Text>
          <View style={styles.areaActions}><SubscriptionButton grow label={location ? 'Change area' : 'Search an area'} disabled={!ready} onPress={() => setAreaSearchOpen(true)} /><SubscriptionButton grow label={locationStatus === 'loading' ? 'Getting GPS…' : 'Use GPS'} disabled={!ready || locationStatus === 'loading'} onPress={() => void startLocationSearch()} /></View>
        </View>
        {(locationStatus === 'denied' || locationStatus === 'unavailable') && <View style={styles.statusBox}><Text style={styles.statusTitle}>{locationStatus === 'denied' ? 'Location access is off' : 'Could not get GPS location'}</Text><Text style={styles.statusText}>{location ? 'Your selected search area is still in use. ' : ''}Search by city or ZIP, choose a saved area, or pan the map and tap Search this area.</Text></View>}
        {(locationStatus === 'loading' || canShowResults && (isLoading || isFetching)) && <View style={styles.loadingBox}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.loadingText}>{locationStatus === 'loading' ? 'Getting GPS. You can also search an area.' : isCached ? 'Showing saved stations · refreshing…' : isPartial ? `Stations within ${coveredRadius} mi · searching out to ${selectedRadius} mi…` : 'Finding stations in this area…'}</Text></View>}
        {canShowResults && isCached && <View style={styles.statusBox}><Text style={styles.statusTitle}>{refreshFailed ? 'Station refresh unavailable' : 'Saved station results'}</Text><Text style={styles.statusText}>Saved {fetchedAt ? new Date(fetchedAt).toLocaleString() : 'earlier'}{coveredRadius < selectedRadius ? ` · covers ${coveredRadius} mi` : ''}. Distances are from your search center. Prices keep their original report dates.</Text>{refreshFailed && <SubscriptionButton label="Retry search" onPress={() => void refetch()} />}</View>}
        {canShowResults && expansionFailed && <Text style={styles.noPriceNote}>Wider search unavailable. Showing stations within {coveredRadius} mi.</Text>}
        {canShowResults && isError && <View style={styles.statusBox}><Text style={styles.statusTitle}>Station search unavailable</Text><Text style={styles.statusText}>{searchError instanceof Error ? searchError.message : 'Check your connection and try again.'} Your search area is kept. Saved report locations can still appear below.</Text><SubscriptionButton label="Retry search" onPress={() => void refetch()} /></View>}
        <View style={styles.filters}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={styles.filterToggle}>
            <View style={{ flex: 1 }}><Text style={styles.filterToggleTitle}>Filters</Text><Text style={styles.filterSummary}>{selectedFuelType} · {priceQualifier} · {selectedRadius} mi · {sortOrder}{recentPricesOnly ? ' · last 24h' : hideUnpricedStations ? ' · prices only' : ''}</Text></View>
            <Text style={styles.filterChevron}>{filtersOpen ? '−' : '+'}</Text>
          </Pressable>
          {filtersOpen && <>
          <View style={styles.pillRow}>{priceQualifiers.map(value => <Pressable key={value.id} accessibilityRole="button" accessibilityState={{ selected: priceQualifier === value.id }} style={[styles.pill, priceQualifier === value.id && styles.activePill]} onPress={() => setPriceQualifier(value.id)}><Text style={[styles.pillText, priceQualifier === value.id && styles.activePillText]}>{value.label}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Recent prices only" accessibilityState={{ checked: recentPricesOnly }} aria-checked={recentPricesOnly} onPress={() => setRecentPricesOnly(!recentPricesOnly)} style={styles.filterToggle}><Text style={[styles.pillText, { flex: 1 }]}>Only prices reported in the last 24 hours</Text><Text style={styles.filterChevron}>{recentPricesOnly ? '☑' : '☐'}</Text></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Hide stations without a price" accessibilityState={{ checked: hideUnpricedStations }} aria-checked={hideUnpricedStations} onPress={() => setHideUnpricedStations(!hideUnpricedStations)} style={styles.filterToggle}><Text style={[styles.pillText, { flex: 1 }]}>Hide stations without a price</Text><Text style={styles.filterChevron}>{hideUnpricedStations ? '☑' : '☐'}</Text></Pressable>
          <Text style={styles.noPriceNote}>Applies to {selectedFuelType} prices on the map and in the list. N/A means no price saved.</Text>
          {!!stationApiBaseUrl && <View style={styles.pillRow}><Pressable accessibilityRole="button" style={styles.pill} onPress={() => setMode('nearby')}><Text style={styles.pillText}>Nearby map</Text></Pressable><Pressable accessibilityRole="button" style={styles.pill} onPress={() => { setViewMode('list'); setMode('online'); }}><Text style={styles.pillText}>Google prices</Text></Pressable></View>}
          <View style={styles.filterPanel}>
            <Text style={styles.sectionTitle}>Fuel</Text>
            <View style={styles.pillRow}>
              {fuelOptions.map((fuel) => (
                <Pressable
                  key={fuel}
                  accessibilityRole="button" accessibilityState={{ selected: selectedFuelType === fuel }} style={[styles.pill, selectedFuelType === fuel && styles.activePill]}
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
                <Pressable key={sort} accessibilityRole="button" accessibilityState={{ selected: sortOrder === sort }} style={[styles.pill, sortOrder === sort && styles.activePill]} onPress={() => setSortOrder(sort)}>
                  <Text style={[styles.pillText, sortOrder === sort && styles.activePillText]}>{sort}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterPanel}>
            <Text style={styles.sectionTitle}>Radius</Text>
            <View style={styles.pillRow}>
              {[5, 10, 25].map((radius) => (
                <Pressable
                  key={radius}
                  accessibilityRole="button" accessibilityState={{ selected: selectedRadius === radius }}
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

        {canShowResults && !isLoading && !isFetching && !isError && stations.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{(hideUnpricedStations || recentPricesOnly) && allStations.length > 0 ? `No saved ${selectedFuelType} prices` : isCached ? 'No saved stations in this area' : 'No stations found in this radius'}</Text>
            <Text style={styles.emptyText}>{(hideUnpricedStations || recentPricesOnly) && allStations.length > 0 ? 'Stations are hidden by your price filters. Try another price type or include older/unpriced stations.' : 'Try expanding your search radius.'}</Text>
            {(hideUnpricedStations || recentPricesOnly) && allStations.length > 0 && <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => { setHideUnpricedStations(false); setRecentPricesOnly(false); }}><Text style={styles.retryText}>Show all stations</Text></Pressable>}
          </View>
        )}

        <View style={styles.viewToggle}>
          {(['map', 'list'] as const).map((view) => <Pressable key={view} accessibilityRole="button" accessibilityState={{ selected: viewMode === view, disabled: mode === 'online' && view === 'map' }} disabled={mode === 'online' && view === 'map'} onPress={() => setViewMode(view)} style={[styles.viewButton, viewMode === view && styles.activePill]}><Text style={[styles.pillText, viewMode === view && styles.activePillText]}>{view === 'map' ? 'Map' : 'List'}</Text></Pressable>)}
          <Text style={styles.mapCount}>{stations.length} station{stations.length === 1 ? '' : 's'}</Text>
        </View>
        {mode === 'online' && <Text style={styles.noPriceNote}>Google results are available in List. Choose Nearby map in Filters for the free map.</Text>}
        {viewMode === 'map' && <>
          <View style={styles.mapFrame}>
            <StationMap key={`${mode}-${selectedRadius}`} pins={canShowResults ? mapPins : []} center={location} centerLabel="Search center" onSearchArea={searchMapArea} selectedId={selectedStationId} onSelect={selectPin} dom={{ useExpoDOMWebView: false, style: { height: 370 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} />
          </View>
          {selectedStation ? <GasStationCard key={selectedStation.id} station={selectedStation} fuelType={selectedFuelType} isCheapest={selectedStation.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt canFavorite={mode === 'nearby'} distanceLabel="from search center" onReported={() => void refetch()} /> : <Text style={styles.noPriceNote}>Tap a station marker for directions, reports and price history. Map locations are from OpenStreetMap; reported prices are unverified.</Text>}
        </>}

        <View style={styles.quickActions}>
          <Link href="/report-price" asChild><Pressable accessibilityRole="button" style={styles.quickReport}><Text style={styles.quickReportText}>+ Report price / refill</Text></Pressable></Link>
          <Link href="/on-route" asChild><Pressable accessibilityRole="button" style={styles.quickRoute}><Text style={styles.quickRouteText}>Gas on your drive ↗</Text></Pressable></Link>
        </View>
        {viewMode === 'list' && canShowResults && !isLoading && stations.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionEyebrow}>Stations</Text>
            {mode === 'online' && data?.provider === 'Google Maps' && <Image source={require('../../../assets/google-maps-logo.png')} style={styles.googleLogo} accessibilityLabel="Google Maps" />}
            {!cheapest && <Text style={styles.noPriceNote}>No recent {selectedFuelType} prices in these results. Older saved prices may still be shown.</Text>}
            {stations.map((station) => (
              <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={station.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt canFavorite={mode === 'nearby'} distanceLabel="from search center" onReported={() => void refetch()} />
            ))}
          </View>
        )}

        <MyCarsSection />

        <Text style={styles.sectionEyebrow}>Your gas reports</Text>
        <Link href="/report-receipt" asChild>
          <Pressable accessibilityRole="button" style={styles.receiptCard}>
            <View style={styles.receiptCopy}><Text style={styles.receiptTitle}>Fuel reports & receipts</Text><Text style={styles.receiptText}>{receiptCount === 0 ? 'Add a price, refill or receipt on this device.' : `${receiptCount} saved report${receiptCount === 1 ? '' : 's'} · add or review`}</Text></View>
            <Text style={styles.receiptArrow}>›</Text>
          </Pressable>
        </Link>

      </ScrollView>
      {areaSearchOpen && <AreaSearchSheet onChoose={chooseArea} onClose={() => setAreaSearchOpen(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 8, marginBottom: 10 },
  areaLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, areaName: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21 }, areaActions: { flexDirection: 'row', gap: 8 },
  statusBox: { padding: 12, borderRadius: 10, backgroundColor: colors.paleOrange, gap: 7, marginBottom: 10 }, statusTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, statusText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  viewButton: { minHeight: 44, minWidth: 70, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7 },
  mapCount: { marginLeft: 'auto', color: colors.muted, fontSize: 12 },
  mapFrame: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 },
  headerRow: { marginBottom: 12 },
  brand: { fontSize: 11, fontWeight: '800', letterSpacing: 2.1, color: colors.accentDark, marginBottom: 12 },
  title: { fontSize: 39, lineHeight: 44, letterSpacing: -1.7, fontWeight: '800', color: colors.ink },
  headerNote: { fontSize: 15, color: colors.muted, marginTop: 7 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  quickReport: { borderRadius: 6, backgroundColor: colors.accentDark, minHeight: 44, justifyContent: 'center', paddingHorizontal: 15 },
  quickReportText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  quickRoute: { borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center', paddingHorizontal: 13 },
  quickRouteText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  receiptCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 15, minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  receiptCopy: { flex: 1 },
  receiptTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  receiptText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  receiptArrow: { color: colors.accentDark, fontSize: 28, marginLeft: 12 },
  reportList: { marginBottom: 16 },
  reportListToggle: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportListTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  reportListChevron: { color: colors.accentDark, fontSize: 24 },
  savedReport: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, padding: 13, marginBottom: 7 },
  savedReportTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  savedReportName: { color: colors.ink, fontWeight: '800', fontSize: 14, flex: 1 },
  savedReportPrice: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
  savedReportMeta: { color: colors.muted, fontSize: 12, marginTop: 5, textTransform: 'capitalize' },
  savedReportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 11 },
  savedReportAction: { color: colors.accentDark, fontSize: 12, fontWeight: '700' },
  savedReportDelete: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  sourceText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  sectionEyebrow: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  filters: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
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
  loadingBox: { backgroundColor: colors.surface, borderRadius: 8, padding: 12, alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 14 },
  loadingText: { flex: 1, color: colors.muted, fontSize: 14 },
  listSection: { marginTop: 4 },
  googleLogo: { width: 98, height: 18, marginVertical: 9 },
  noPriceNote: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyCard: { marginBottom: 12, backgroundColor: colors.surface, borderRadius: 8, padding: 12, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptyText: { marginTop: 8, color: colors.muted },
  retryButton: { marginTop: 14, backgroundColor: colors.ink, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16 },
  retryText: { color: colors.surface, fontWeight: '700' },
});
