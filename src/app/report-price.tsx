import { colors } from '@/theme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { usePriceReportStore } from '@/stores/priceReportStore';
import type { FuelType } from '@/types/stations';

const fuels: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];

export default function ReportPriceScreen() {
  const params = useLocalSearchParams<{ reportId?: string; stationId?: string; stationName?: string; stationAddress?: string; latitude?: string; longitude?: string; fuelType?: FuelType }>();
  const saved = usePriceReportStore((state) => state.reports.find((report) => report.id === params.reportId));
  const saveReport = usePriceReportStore((state) => state.saveReport);
  const [stationId, setStationId] = useState(saved?.stationId ?? params.stationId);
  const [stationName, setStationName] = useState(saved?.stationName ?? params.stationName ?? '');
  const [stationAddress, setStationAddress] = useState(saved?.stationAddress ?? params.stationAddress ?? '');
  const [latitude, setLatitude] = useState(saved ? String(saved.latitude) : params.latitude ?? '');
  const [longitude, setLongitude] = useState(saved ? String(saved.longitude) : params.longitude ?? '');
  const [locationSource, setLocationSource] = useState<'map' | 'device' | 'entered'>(saved?.locationSource ?? (params.stationId ? 'map' : 'entered'));
  const [fuelType, setFuelType] = useState<FuelType>(saved?.fuelType ?? (params.fuelType && fuels.includes(params.fuelType) ? params.fuelType : 'regular'));
  const [priceInput, setPriceInput] = useState(saved ? String(saved.price) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function changeCoordinates(next: string, field: 'latitude' | 'longitude') {
    if (field === 'latitude') setLatitude(next);
    else setLongitude(next);
    setLocationSource('entered');
    setStationId(undefined);
  }

  async function attachMyLocation() {
    setError('');
    setBusy(true);
    try {
      if (!await requestLocationPermission()) {
        setError('Location access was denied. Enter coordinates instead.');
        return;
      }
      const coordinates = await getCurrentLocation();
      setLatitude(String(coordinates.latitude));
      setLongitude(String(coordinates.longitude));
      setLocationSource('device');
      setStationId(undefined);
    } catch {
      setError('Could not get your location. Enter coordinates instead.');
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    setError('');
    const price = Number(priceInput.trim());
    const lat = Number(latitude.trim());
    const lon = Number(longitude.trim());
    if (!/^\d+(?:\.\d{1,3})?$/.test(priceInput.trim()) || price <= 0 || price > 30) {
      setError('Enter a price from $0.001 to $30.000 per gallon.');
      return;
    }
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setError('Use your location or enter valid latitude and longitude.');
      return;
    }
    saveReport({
      id: saved?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      stationId,
      stationName: stationName.trim() || 'Name not listed',
      stationAddress: stationAddress.trim(),
      latitude: lat,
      longitude: lon,
      locationSource,
      fuelType,
      price,
      reportedAt: new Date().toISOString(),
    });
    router.back();
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>GAS PRICES</Text>
        <Text style={styles.title}>{saved ? 'Edit price report' : 'Report a price'}</Text>
        <Text style={styles.intro}>Record the price per gallon you saw. No receipt is needed. Your report stays on this device and is unverified.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Station name (optional)</Text>
          <TextInput style={styles.input} value={stationName} onChangeText={setStationName} placeholder="Name not listed" accessibilityLabel="Station name" maxLength={120} />
          <Text style={styles.label}>Address (optional)</Text>
          <TextInput style={styles.input} value={stationAddress} onChangeText={setStationAddress} placeholder="Street or nearby landmark" accessibilityLabel="Station address" maxLength={180} />
          {stationId && <Text style={styles.note}>Linked to the mapped station. Its mapped coordinates are filled in below.</Text>}
          <Text style={styles.label}>Location</Text>
          <Pressable accessibilityRole="button" style={styles.locationButton} onPress={() => void attachMyLocation()} disabled={busy}><Text style={styles.locationButtonText}>{busy ? 'Locating…' : 'Use my current location'}</Text></Pressable>
          <Text style={styles.note}>{locationSource === 'map' ? 'Mapped station coordinates' : locationSource === 'device' ? 'GPS coordinates from this device' : 'Enter coordinates or use your location'}. Changing coordinates removes the mapped station link.</Text>
          <View style={styles.coordinateRow}>
            <View style={styles.coordinateField}><Text style={styles.label}>Latitude</Text><TextInput style={styles.input} value={latitude} onChangeText={(value) => changeCoordinates(value, 'latitude')} keyboardType="numbers-and-punctuation" placeholder="40.7128" accessibilityLabel="Latitude" /></View>
            <View style={styles.coordinateField}><Text style={styles.label}>Longitude</Text><TextInput style={styles.input} value={longitude} onChangeText={(value) => changeCoordinates(value, 'longitude')} keyboardType="numbers-and-punctuation" placeholder="-74.0060" accessibilityLabel="Longitude" /></View>
          </View>
          <Text style={styles.label}>Fuel type</Text>
          <View style={styles.fuelRow}>{fuels.map((fuel) => <Pressable key={fuel} accessibilityRole="button" accessibilityState={{ selected: fuelType === fuel }} style={[styles.choice, fuelType === fuel && styles.choiceSelected]} onPress={() => setFuelType(fuel)}><Text style={[styles.choiceText, fuelType === fuel && styles.choiceTextSelected]}>{fuel}</Text></Pressable>)}</View>
          <Text style={styles.label}>Price per gallon</Text>
          <TextInput style={styles.input} value={priceInput} onChangeText={setPriceInput} keyboardType="decimal-pad" placeholder="3.199" accessibilityLabel="Price per gallon" maxLength={7} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.saveButton} onPress={submit} disabled={busy}><Text style={styles.saveText}>{saved ? 'Save changes' : 'Save price report'}</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800', marginTop: 8 },
  intro: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 18 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 14 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, minHeight: 46, paddingHorizontal: 12, color: colors.ink, fontSize: 15 },
  locationButton: { backgroundColor: colors.ink, borderRadius: 6, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  locationButtonText: { color: colors.surface, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  coordinateRow: { flexDirection: 'row', gap: 10 },
  coordinateField: { flex: 1 },
  fuelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 11 },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.inkSoft, textTransform: 'capitalize', fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: colors.surface },
  error: { color: colors.danger, marginTop: 12, fontSize: 13 },
  saveButton: { backgroundColor: colors.accentDark, borderRadius: 6, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { color: colors.surface, fontWeight: '800' },
});
