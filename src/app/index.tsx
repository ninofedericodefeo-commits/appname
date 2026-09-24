import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GasStationCard } from '@/components/GasStationCard';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { useNearbyStations } from '@/features/stations/hooks';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInvestmentStore } from '@/stores/investmentStore';
import type { PaymentMethod } from '@/types/investing';
import type { FuelType } from '@/types/stations';

const fuelOptions: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
const defaultLocation = { latitude: 39.9526, longitude: -75.1652 };
const paymentMethods: PaymentMethod[] = ['phone', 'debit', 'credit'];

export default function HomeScreen() {
  const { selectedFuelType, selectedRadius, sortOrder, setSelectedFuelType, setSelectedRadius, setSortOrder } = useSettingsStore();
  const { investedBalance, withdrawnTotal, monthlyDecision, addPayment, keepInvested, sellInvested } = useInvestmentStore();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('phone');
  const [paymentError, setPaymentError] = useState('');
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
            setLocation(defaultLocation);
            setPermissionDenied(false);
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
          setLocation(defaultLocation);
          setPermissionDenied(false);
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
    latitude: location?.latitude ?? defaultLocation.latitude,
    longitude: location?.longitude ?? defaultLocation.longitude,
    radius: selectedRadius,
    fuelType: selectedFuelType,
    sortOrder,
  });

  const stations = useMemo(() => data?.stations ?? [], [data?.stations]);
  const cheapest = useMemo(() => {
    if (!stations.length) return null;
    return stations[0];
  }, [stations]);
  const surchargePreview = Number(paymentAmount) > 0 ? Math.round(Number(paymentAmount) * 0.005 * 100) / 100 : 0;

  function recordPayment() {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a payment amount greater than $0.');
      return;
    }

    addPayment(amount, paymentMethod);
    setPaymentAmount('');
    setPaymentError('');
  }

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

              <View style={styles.investmentCard}>
                <Text style={styles.investmentEyebrow}>LOCAL DEMO</Text>
                <Text style={styles.investmentTitle}>Invest 0.5% of each payment</Text>
                <Text style={styles.investmentText}>
                  This prototype simulates a surcharge and S&P 500 investment. It does not charge a card or buy stocks.
                </Text>
                <View style={styles.balanceRow}>
                  <View>
                    <Text style={styles.balanceLabel}>Simulated invested</Text>
                    <Text style={styles.balanceValue}>${investedBalance.toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceLabel}>Sold this demo</Text>
                    <Text style={styles.balanceValue}>${withdrawnTotal.toFixed(2)}</Text>
                  </View>
                </View>
                <TextInput
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="Payment amount (e.g. 45.00)"
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                />
                <View style={styles.pillRow}>
                  {paymentMethods.map((method) => (
                    <Pressable key={method} style={[styles.pill, paymentMethod === method && styles.activePill]} onPress={() => setPaymentMethod(method)}>
                      <Text style={[styles.pillText, paymentMethod === method && styles.activePillText]}>{method}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.surchargeText}>Surcharge to invest: ${surchargePreview.toFixed(2)}</Text>
                {paymentError ? <Text style={styles.formError}>{paymentError}</Text> : null}
                <Pressable style={styles.primaryButton} onPress={recordPayment}>
                  <Text style={styles.primaryButtonText}>Simulate Payment</Text>
                </Pressable>
                <Text style={styles.monthLabel}>Monthly decision</Text>
                <View style={styles.actionsRow}>
                  <Pressable style={styles.secondaryButton} onPress={keepInvested}>
                    <Text style={styles.secondaryButtonText}>Keep invested</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={sellInvested}>
                    <Text style={styles.secondaryButtonText}>Sell balance</Text>
                  </Pressable>
                </View>
                {monthlyDecision !== 'pending' ? <Text style={styles.decisionText}>This month: {monthlyDecision}</Text> : null}
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
  investmentCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  investmentEyebrow: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  investmentTitle: {
    marginTop: 5,
    fontSize: 20,
    fontWeight: '800',
    color: '#064e3b',
  },
  investmentText: {
    marginTop: 7,
    color: '#166534',
    fontSize: 13,
    lineHeight: 19,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  balanceLabel: {
    color: '#166534',
    fontSize: 12,
  },
  balanceValue: {
    marginTop: 2,
    color: '#064e3b',
    fontSize: 22,
    fontWeight: '800',
  },
  amountInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 10,
  },
  surchargeText: {
    marginTop: 10,
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  formError: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 13,
  },
  monthLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  decisionText: {
    marginTop: 10,
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
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
