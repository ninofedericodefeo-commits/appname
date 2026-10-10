import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import StationMap from '@/components/StationMap';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { stationApiBaseUrl } from '@/features/stations/data';
import { useNearbyStations } from '@/features/stations/hooks';
import { formatFuelPrice, prepareStations } from '@/features/stations/logic';
import { withLocalPrices } from '@/features/stations/localPrices';
import { useSettingsStore } from '@/stores/settingsStore';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function GasScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const [mode, setMode] = useState<'nearby' | 'online'>('nearby');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const receiptReports = useReceiptStore((state) => state.reports);
  const priceReports = usePriceReportStore((state) => state.reports);
  const removePriceReport = usePriceReportStore((state) => state.removeReport);
  const receiptCount = receiptReports.length;
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'unavailable'>('loading');
  const initialSearchStarted = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const startLocationSearch = useCallback(async (nextMode: 'nearby' | 'online') => {
    setMode(nextMode);
    if (selectedRadius > 25) setSelectedRadius(25);
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
  }, [selectedRadius, setSelectedRadius]);

  useEffect(() => {
    if (initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    void startLocationSearch('nearby');
  }, [startLocationSearch]);

  const { data, isLoading, isFetching, isError, isPartial, expansionFailed, error: searchError, refetch } = useNearbyStations({
    mode,
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });
  const stations = useMemo(() => {
    const found = data?.stations ?? [];
    if (!location) return found;
    return prepareStations(withLocalPrices(found, receiptReports, priceReports), { ...location, radius: selectedRadius, fuelType: selectedFuelType, sortOrder });
  }, [data?.stations, location, receiptReports, priceReports, selectedRadius, selectedFuelType, sortOrder]);
  const cheapest = stations.reduce<(typeof stations)[number] | undefined>((best, station) => {
    const price = station.prices.find((item) => item.fuelType === selectedFuelType)?.price;
    const bestPrice = best?.prices.find((item) => item.fuelType === selectedFuelType)?.price;
    return price !== undefined && (bestPrice === undefined || price < bestPrice) ? station : best;
  }, undefined);
  const canShowResults = (location !== null && locationStatus !== 'denied' && locationStatus !== 'unavailable');
  const selectedStation = stations.find((station) => station.id === selectedStationId);
  const mapPins = useMemo(() => stations.map((station) => ({
    id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude,
    price: station.prices.find((price) => price.fuelType === selectedFuelType)?.price ?? null, sample: false,
  })), [stations, selectedFuelType]);
  const selectPin = useCallback(async (id: string) => setSelectedStationId(id), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.pillRow}><Text style={styles.brand}>GASFINDER</Text><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.filterToggle}><Text style={styles.sourceText}>Settings ›</Text></Pressable></Link></View>
          <Text style={styles.title}>Gas stations</Text>
          <Text style={styles.headerNote}>Find nearby stations and record prices you see.</Text>
        </View>

        {(locationStatus === 'loading' || canShowResults && (isLoading || isFetching)) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>{isPartial ? `Showing stations within 2 mi · searching out to ${selectedRadius} mi…` : 'Finding nearby stations…'}</Text>
          </View>
        )}

        <View style={styles.viewToggle}>
          {(['map', 'list'] as const).map((view) => <Pressable key={view} accessibilityRole="button" accessibilityState={{ selected: viewMode === view, disabled: mode === 'online' && view === 'map' }} disabled={mode === 'online' && view === 'map'} onPress={() => setViewMode(view)} style={[styles.viewButton, viewMode === view && styles.activePill]}><Text style={[styles.pillText, viewMode === view && styles.activePillText]}>{view === 'map' ? 'Map' : 'List'}</Text></Pressable>)}
          <Text style={styles.mapCount}>{stations.length} station{stations.length === 1 ? '' : 's'}</Text>
        </View>
        {mode === 'online' && <Text style={styles.noPriceNote}>Google results are available in List. Choose Nearby map in Filters for the free map.</Text>}
        {viewMode === 'map' && <>
          <View style={styles.mapFrame}>
            <StationMap key={`${mode}-${selectedRadius}`} pins={canShowResults ? mapPins : []} center={location} selectedId={selectedStationId} onSelect={selectPin} dom={{ useExpoDOMWebView: false, style: { height: 370 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} />
          </View>
          {selectedStation ? <GasStationCard key={selectedStation.id} station={selectedStation} fuelType={selectedFuelType} isCheapest={selectedStation.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt onReported={() => void refetch()} /> : <Text style={styles.noPriceNote}>Tap a station marker for directions, reports and price history. Map locations are from OpenStreetMap; reported prices are unverified.</Text>}
        </>}

        <View style={styles.quickActions}>
          <Link href="/report-price" asChild><Pressable accessibilityRole="button" style={styles.quickReport}><Text style={styles.quickReportText}>+ Report a price</Text></Pressable></Link>
          <Link href="/on-route" asChild><Pressable accessibilityRole="button" style={styles.quickRoute}><Text style={styles.quickRouteText}>Gas on your drive ↗</Text></Pressable></Link>
        </View>

        <View style={styles.filters}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={styles.filterToggle}>
            <View><Text style={styles.filterToggleTitle}>Filters</Text><Text style={styles.filterSummary}>{selectedFuelType} · {selectedRadius} mi · {sortOrder}</Text></View>
            <Text style={styles.filterChevron}>{filtersOpen ? '−' : '+'}</Text>
          </Pressable>
          {filtersOpen && <>
          {!!stationApiBaseUrl && <View style={styles.pillRow}><Pressable accessibilityRole="button" style={styles.pill} onPress={() => void startLocationSearch('nearby')}><Text style={styles.pillText}>Nearby map</Text></Pressable><Pressable accessibilityRole="button" style={styles.pill} onPress={() => { setViewMode('list'); void startLocationSearch('online'); }}><Text style={styles.pillText}>Google prices</Text></Pressable></View>}
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
              {[5, 10, 25].map((radius) => (
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
          </>}
        </View>

        {locationStatus === 'denied' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location access was denied</Text>
            <Text style={styles.emptyText}>Enable location for GasFinder in your device settings, then try again.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startLocationSearch(mode)}><Text style={styles.retryText}>Try location again</Text></Pressable>
          </View>
        )}
        {locationStatus === 'unavailable' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Location unavailable</Text>
            <Text style={styles.emptyText}>Check your device location service and try again.</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void startLocationSearch(mode)}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
        {canShowResults && expansionFailed && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Wider search unavailable</Text><Text style={styles.emptyText}>Showing stations found within 2 mi. You can try the wider search again.</Text><Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void refetch()}><Text style={styles.retryText}>Retry wider search</Text></Pressable></View>}

        {canShowResults && isError && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Station search failed</Text>
            <Text style={styles.emptyText}>{searchError instanceof Error ? `${searchError.message} Check your connection and try again.` : 'Could not load stations. Check your connection and try again.'}</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void refetch()}><Text style={styles.retryText}>Retry search</Text></Pressable>
          </View>
        )}

        {viewMode === 'list' && canShowResults && !isLoading && !isError && stations.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionEyebrow}>Stations</Text>
            {mode === 'online' && data?.provider === 'Google Maps' && <Image source={require('../../../assets/google-maps-logo.png')} style={styles.googleLogo} accessibilityLabel="Google Maps" />}
            {!cheapest && <Text style={styles.noPriceNote}>No reported {selectedFuelType} prices in these results. You can report a price when you visit.</Text>}
            {stations.map((station) => (
              <GasStationCard key={station.id} station={station} fuelType={selectedFuelType} isCheapest={station.id === cheapest?.id} isDemo={false} now={now} canReport={false} canOpenMaps canAddReceipt onReported={() => void refetch()} />
            ))}
          </View>
        )}

        {canShowResults && !isLoading && !isFetching && !isError && stations.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No stations found in this radius</Text>
            <Text style={styles.emptyText}>Try expanding your search radius.</Text>
          </View>
        )}

        <Text style={styles.sectionEyebrow}>Your gas reports</Text>
        <Link href="/report-receipt" asChild>
          <Pressable accessibilityRole="button" style={styles.receiptCard}>
            <View style={styles.receiptCopy}><Text style={styles.receiptTitle}>Gas receipts</Text><Text style={styles.receiptText}>{receiptCount === 0 ? 'Save a receipt and its price on this device.' : `${receiptCount} saved report${receiptCount === 1 ? '' : 's'} · add or review`}</Text></View>
            <Text style={styles.receiptArrow}>›</Text>
          </Pressable>
        </Link>
        {priceReports.length > 0 && <View style={styles.reportList}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: reportsOpen }} onPress={() => setReportsOpen(!reportsOpen)} style={styles.reportListToggle}><Text style={styles.reportListTitle}>My price reports ({priceReports.length})</Text><Text style={styles.reportListChevron}>{reportsOpen ? '−' : '+'}</Text></Pressable>
          {reportsOpen && priceReports.map((report) => <View key={report.id} style={styles.savedReport}>
            <View style={styles.savedReportTop}><Text style={styles.savedReportName}>{report.stationName}</Text><Text style={styles.savedReportPrice}>{formatFuelPrice(report.price)}</Text></View>
            <Text style={styles.savedReportMeta}>{report.fuelType} · {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)} · {new Date(report.reportedAt).toLocaleDateString()}</Text>
            <View style={styles.savedReportActions}>
              <Link href={{ pathname: '/report-price', params: { reportId: report.id } }} asChild><Pressable accessibilityRole="button"><Text style={styles.savedReportAction}>Edit</Text></Pressable></Link>
              {pendingDelete === report.id ? <><Pressable accessibilityRole="button" onPress={() => { removePriceReport(report.id); setPendingDelete(null); }}><Text style={styles.savedReportDelete}>Confirm delete</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPendingDelete(null)}><Text style={styles.savedReportAction}>Cancel</Text></Pressable></> : <Pressable accessibilityRole="button" onPress={() => setPendingDelete(report.id)}><Text style={styles.savedReportAction}>Delete</Text></Pressable>}
            </View>
          </View>)}
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  viewButton: { minHeight: 44, minWidth: 70, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7 },
  mapCount: { marginLeft: 'auto', color: colors.muted, fontSize: 12 },
  mapFrame: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 },
  headerRow: { marginBottom: 20 },
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
  filters: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 21 },
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
  loadingBox: { backgroundColor: colors.surface, borderRadius: 8, padding: 18, alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 14 },
  loadingText: { color: colors.muted, fontSize: 14 },
  listSection: { marginTop: 4 },
  googleLogo: { width: 98, height: 18, marginVertical: 9 },
  noPriceNote: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 8, padding: 18, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptyText: { marginTop: 8, color: colors.muted },
  retryButton: { marginTop: 14, backgroundColor: colors.ink, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16 },
  retryText: { color: colors.surface, fontWeight: '700' },
});
