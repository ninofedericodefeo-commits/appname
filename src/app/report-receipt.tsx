import { colors } from '@/theme';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { CalendarDateField } from '@/components/CalendarDateField';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { deleteReceiptPhoto, saveReceiptPhoto } from '@/features/receipts/photoStorage';
import { parseReceiptDetails } from '@/features/receipts/validation';
import { useReceiptStore } from '@/stores/receiptStore';
import type { FuelType } from '@/types/stations';

const fuelTypes: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
type SelectedPhoto = { uri: string; mimeType?: string | null };

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export default function ReportReceiptScreen() {
  const params = useLocalSearchParams<{ stationId?: string; stationName?: string; stationAddress?: string; latitude?: string; longitude?: string; fuelType?: FuelType }>();
  const mappedLatitude = Number(params.latitude);
  const mappedLongitude = Number(params.longitude);
  const mappedCoordinates = Number.isFinite(mappedLatitude) && Math.abs(mappedLatitude) <= 90 &&
    Number.isFinite(mappedLongitude) && Math.abs(mappedLongitude) <= 180
    ? { latitude: mappedLatitude, longitude: mappedLongitude } : null;
  const { reports, addReport, removeReport } = useReceiptStore();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [stationName, setStationName] = useState(params.stationName ?? '');
  const [stationAddress, setStationAddress] = useState(params.stationAddress ?? '');
  const [linkedStationId, setLinkedStationId] = useState(params.stationId ?? '');
  const [fuelType, setFuelType] = useState<FuelType>(params.fuelType && fuelTypes.includes(params.fuelType) ? params.fuelType : 'regular');
  const [priceInput, setPriceInput] = useState('');
  const [gallonsInput, setGallonsInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(todayString);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(mappedCoordinates);
  const [locationSource, setLocationSource] = useState<'device' | 'map' | 'entered'>(mappedCoordinates ? 'map' : 'entered');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function unlinkStation() {
    setLinkedStationId('');
    if (locationSource === 'map') {
      setCoordinates(null);
      setLocationSource('entered');
    }
  }

  useEffect(() => {
    void ImagePicker.getPendingResultAsync().then((result) => {
      if (result && 'canceled' in result && !result.canceled && result.assets?.[0]) {
        setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
      }
    }).catch(() => undefined);
  }, []);

  async function choosePhoto(source: 'camera' | 'library') {
    setError('');
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera access was denied. You can choose a receipt from your photo library instead.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
      if (!result.canceled && result.assets[0]) {
        setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
      }
    } catch {
      setError('Could not open the camera or photo library. Please try again.');
    }
  }

  async function attachStationLocation() {
    setError('');
    setBusy(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setError('Location access was denied. Enter the station address instead.');
        return;
      }
      setCoordinates(await getCurrentLocation());
      setLocationSource('device');
    } catch {
      setError('Could not get your location. Enter the station address instead.');
    } finally {
      setBusy(false);
    }
  }

  async function saveReport() {
    setError('');
    if (!photo) {
      setError('Take or choose a receipt photo first.');
      return;
    }
    const parsed = parseReceiptDetails({ stationName, stationAddress, priceInput, gallonsInput, totalInput, purchasedOn, hasCoordinates: coordinates !== null });
    if (!parsed.value) {
      setError(parsed.error ?? 'Check the receipt details.');
      return;
    }
    if (Platform.OS === 'web') {
      setError('Saving receipt photos is available in the iOS or Android app.');
      return;
    }
    setBusy(true);
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const photoUri = await saveReceiptPhoto(photo.uri, id, photo.mimeType);
      addReport({
        id,
        stationId: linkedStationId || undefined,
        photoUri,
        ...parsed.value,
        fuelType,
        locationSource: coordinates ? locationSource : 'entered',
        coordinates: coordinates ?? undefined,
        savedAt: new Date().toISOString(),
      });
      setPhoto(null);
      setStationName('');
      setStationAddress('');
      setLinkedStationId('');
      setPriceInput('');
      setGallonsInput('');
      setTotalInput('');
      setPurchasedOn(todayString());
      setCoordinates(null);
      setLocationSource('entered');
    } catch {
      setError('Could not save the receipt photo on this device. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const report = reports.find((item) => item.id === pendingDelete);
    if (report) {
      try {
        deleteReceiptPhoto(report.photoUri);
        removeReport(report.id);
      } catch {
        setError('Could not remove the saved photo. Please try again.');
      }
    }
    setPendingDelete(null);
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>GAS PRICES</Text>
        <Text style={styles.title}>Receipt report</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Saved only on this device</Text>
          <Text style={styles.noticeText}>Your receipt photo and report stay on this device. The app does not read the photo, so enter and check each detail. Cover payment information in the photo. A receipt linked to a mapped station will show its price in your Gas view.</Text>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.card}><Text style={styles.sectionTitle}>Use the mobile app</Text><Text style={styles.hint}>Receipt photos can be saved in the iOS or Android app. This web preview does not store them.</Text></View>
        ) : (
          <View style={styles.card}>
            <View style={styles.uploadZone}>
              <Text style={styles.uploadStep}>01 / RECEIPT</Text>
              <Text style={styles.sectionTitle}>Add a receipt photo</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void choosePhoto('camera')}><Text style={styles.actionText}>Take photo</Text></Pressable>
                <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void choosePhoto('library')}><Text style={styles.actionText}>Choose photo</Text></Pressable>
              </View>
              {photo && <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Selected gas receipt" />}
            </View>

            <Text style={styles.sectionTitle}>02 / Confirm the details</Text>
            <Text style={styles.label}>Station name</Text>
            {linkedStationId && <View style={styles.linkedStation}><Text style={styles.linkedStationText}>Linked to the station you selected in Gas</Text><Pressable accessibilityRole="button" onPress={unlinkStation}><Text style={styles.unlinkText}>Unlink</Text></Pressable></View>}
            <TextInput style={styles.input} value={stationName} onChangeText={setStationName} placeholder="Name on receipt" accessibilityLabel="Station name" maxLength={100} />
            <Text style={styles.label}>Station address</Text>
            <TextInput style={styles.input} value={stationAddress} onChangeText={setStationAddress} placeholder="Street, city, state" accessibilityLabel="Station address" maxLength={180} />
            <Text style={styles.hint}>Enter the address if you are no longer at the station. Otherwise you can attach your current location below.</Text>
            <Text style={styles.label}>Fuel type</Text>
            <View style={styles.row}>
              {fuelTypes.map((fuel) => (
                <Pressable key={fuel} accessibilityRole="button" accessibilityState={{ selected: fuelType === fuel }} style={[styles.choice, fuelType === fuel && styles.choiceSelected]} onPress={() => setFuelType(fuel)}>
                  <Text style={[styles.choiceText, fuelType === fuel && styles.choiceTextSelected]}>{fuel}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Price per gallon</Text>
            <TextInput style={styles.input} value={priceInput} onChangeText={setPriceInput} placeholder="3.199" keyboardType="decimal-pad" accessibilityLabel="Price per gallon" maxLength={8} />
            <View style={styles.row}>
              <View style={styles.halfField}><Text style={styles.label}>Gallons (optional)</Text><TextInput style={styles.input} value={gallonsInput} onChangeText={setGallonsInput} placeholder="10.000" keyboardType="decimal-pad" accessibilityLabel="Gallons purchased" maxLength={8} /></View>
              <View style={styles.halfField}><Text style={styles.label}>Total (optional)</Text><TextInput style={styles.input} value={totalInput} onChangeText={setTotalInput} placeholder="31.99" keyboardType="decimal-pad" accessibilityLabel="Receipt total" maxLength={9} /></View>
            </View>
            <Text style={styles.label}>Purchase date</Text>
            <CalendarDateField label="Purchase date" value={purchasedOn} onChange={setPurchasedOn} maximumDate={todayString()} />

            <Text style={styles.sectionTitle}>03 / Confirm the station location</Text>
            <Text style={styles.hint}>Use your current GPS location only if you are at the gas station now. A receipt photo does not prove where it was taken.</Text>
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void attachStationLocation()} disabled={busy}><Text style={styles.secondaryText}>{coordinates ? 'Update station GPS location' : 'Use my location at the station'}</Text></Pressable>
            {coordinates && <View><Text style={styles.locationText}>{locationSource === 'map' ? 'Mapped station' : 'Attached GPS'}: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</Text><Pressable accessibilityRole="button" onPress={() => { setCoordinates(null); setLocationSource('entered'); }}><Text style={styles.removeText}>Remove location</Text></Pressable></View>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" style={[styles.saveButton, busy && styles.disabled]} onPress={() => void saveReport()} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save receipt report</Text>}
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My reports ({reports.length})</Text>
          {reports.length === 0 ? <Text style={styles.hint}>Saved receipt reports will appear here.</Text> : reports.map((report) => (
            <View key={report.id} style={styles.reportRow}>
              {Platform.OS !== 'web' && <Image source={{ uri: report.photoUri }} style={styles.thumbnail} accessibilityLabel={`Receipt for ${report.stationName}`} />}
              <View style={styles.reportDetails}>
                <Text style={styles.reportName}>{report.stationName}</Text>
                <Text style={styles.reportMeta}>${report.pricePerGallon.toFixed(3)}/gal · {report.fuelType} · {new Date(`${report.purchasedOn}T12:00:00`).toLocaleDateString()}</Text>
                <Text style={styles.reportMeta}>{report.stationAddress || 'Location attached'} · {report.locationSource === 'device' ? 'GPS at submission' : report.locationSource === 'map' ? 'Mapped station' : 'Address entered'}</Text>
                {report.coordinates && <Text style={styles.reportMeta}>{report.coordinates.latitude.toFixed(5)}, {report.coordinates.longitude.toFixed(5)}</Text>}
                <Pressable accessibilityRole="button" style={styles.removeButton} onPress={() => setPendingDelete(report.id)}><Text style={styles.removeText}>Delete report and photo</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
        {pendingDelete && <View style={styles.confirmCard}>
          <Text style={styles.reportName}>Delete this report and its saved photo?</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete}><Text style={styles.saveText}>Delete</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setPendingDelete(null)}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
          </View>
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  linkedStation: { backgroundColor: colors.paleGreen, padding: 10, borderRadius: 7, flexDirection: 'row', gap: 10, alignItems: 'center' },
  linkedStationText: { color: colors.inkSoft, fontSize: 12, flex: 1 },
  unlinkText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 },
  navButton: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  navText: { color: colors.surface, fontWeight: '700' },
  notice: { backgroundColor: colors.paleGreen, borderLeftColor: colors.primary, borderLeftWidth: 3, padding: 15 },
  noticeTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  noticeText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 18, marginBottom: 10 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 5 },
  uploadZone: { backgroundColor: colors.paleOrange, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: 8, padding: 16, marginBottom: 12 },
  uploadStep: { color: colors.accentDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 },
  actionButton: { backgroundColor: colors.accentDark, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12 },
  actionText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  preview: { width: '100%', height: 220, backgroundColor: colors.paper, borderRadius: 8, marginVertical: 10 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700', marginTop: 11, marginBottom: 5 },
  input: { backgroundColor: colors.surface, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontSize: 15 },
  halfField: { flex: 1, minWidth: 130 },
  choice: { backgroundColor: colors.paper, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.inkSoft, fontWeight: '600', textTransform: 'capitalize' },
  choiceTextSelected: { color: colors.surface },
  secondaryButton: { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 12, alignSelf: 'flex-start' },
  secondaryText: { color: colors.ink, fontWeight: '700' },
  locationText: { color: colors.primary, fontSize: 12, marginTop: 6 },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, lineHeight: 18 },
  saveButton: { backgroundColor: colors.accentDark, borderRadius: 6, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: colors.surface, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.5 },
  reportRow: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  thumbnail: { width: 64, height: 80, backgroundColor: colors.paper, borderRadius: 7 },
  reportDetails: { flex: 1 },
  reportName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  reportMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 2 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  confirmCard: { backgroundColor: colors.dangerPale, borderColor: colors.accent, borderWidth: 1, borderRadius: 10, padding: 15 },
  deleteButton: { backgroundColor: colors.danger, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 12 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 1 },
});
