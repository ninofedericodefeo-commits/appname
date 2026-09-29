import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const { reports, addReport, removeReport } = useReceiptStore();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [stationName, setStationName] = useState('');
  const [stationAddress, setStationAddress] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('regular');
  const [priceInput, setPriceInput] = useState('');
  const [gallonsInput, setGallonsInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(todayString);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
        photoUri,
        ...parsed.value,
        fuelType,
        locationSource: coordinates ? 'device' : 'entered',
        coordinates: coordinates ?? undefined,
        savedAt: new Date().toISOString(),
      });
      setPhoto(null);
      setStationName('');
      setStationAddress('');
      setPriceInput('');
      setGallonsInput('');
      setTotalInput('');
      setPurchasedOn(todayString());
      setCoordinates(null);
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Receipt report</Text>
          <Link href="/" asChild><Pressable accessibilityRole="button" style={styles.navButton}><Text style={styles.navText}>Gas prices</Text></Pressable></Link>
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Saved only on this device</Text>
          <Text style={styles.noticeText}>A photo supports your report, but the app does not read receipt text automatically or publish prices to other users yet. Check every detail before saving. Cover any payment details you do not want in the photo.</Text>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.card}><Text style={styles.sectionTitle}>Use the mobile app</Text><Text style={styles.hint}>Receipt photos can be saved in the iOS or Android app. This web preview does not store them.</Text></View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Add a receipt photo</Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void choosePhoto('camera')}><Text style={styles.actionText}>Take photo</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void choosePhoto('library')}><Text style={styles.actionText}>Choose photo</Text></Pressable>
            </View>
            {photo && <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Selected gas receipt" />}

            <Text style={styles.sectionTitle}>2. Confirm the details</Text>
            <Text style={styles.label}>Station name</Text>
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
            <Text style={styles.label}>Purchase date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={purchasedOn} onChangeText={setPurchasedOn} placeholder="2026-09-28" accessibilityLabel="Purchase date" maxLength={10} />

            <Text style={styles.sectionTitle}>3. Confirm the station location</Text>
            <Text style={styles.hint}>Use your current GPS location only if you are at the gas station now. A receipt photo does not prove where it was taken.</Text>
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void attachStationLocation()} disabled={busy}><Text style={styles.secondaryText}>{coordinates ? 'Update station GPS location' : 'Use my location at the station'}</Text></Pressable>
            {coordinates && <View><Text style={styles.locationText}>Attached GPS: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</Text><Pressable accessibilityRole="button" onPress={() => setCoordinates(null)}><Text style={styles.removeText}>Remove GPS location</Text></Pressable></View>}
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
                <Text style={styles.reportMeta}>${report.pricePerGallon.toFixed(3)}/gal · {report.fuelType} · {report.purchasedOn}</Text>
                <Text style={styles.reportMeta}>{report.stationAddress || 'GPS location attached'} · {report.locationSource === 'device' ? 'GPS at submission' : 'Address entered'}</Text>
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
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: '#111827', fontSize: 27, fontWeight: '800', flexShrink: 1 },
  navButton: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 },
  navText: { color: '#fff', fontWeight: '700' },
  notice: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 15, padding: 15 },
  noticeTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 15 },
  noticeText: { color: '#334155', fontSize: 13, lineHeight: 19, marginTop: 5 },
  card: { backgroundColor: '#fff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 17, padding: 16 },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '800', marginTop: 12, marginBottom: 7 },
  hint: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginBottom: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 },
  actionButton: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  preview: { width: '100%', height: 220, backgroundColor: '#f3f4f6', borderRadius: 12, marginVertical: 10 },
  label: { color: '#374151', fontSize: 13, fontWeight: '700', marginTop: 11, marginBottom: 5 },
  input: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontSize: 15 },
  halfField: { flex: 1, minWidth: 130 },
  choice: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 11 },
  choiceSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { color: '#374151', fontWeight: '600', textTransform: 'capitalize' },
  choiceTextSelected: { color: '#fff' },
  secondaryButton: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignSelf: 'flex-start' },
  secondaryText: { color: '#111827', fontWeight: '700' },
  locationText: { color: '#0369a1', fontSize: 12, marginTop: 6 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12, lineHeight: 18 },
  saveButton: { backgroundColor: '#047857', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.5 },
  reportRow: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  thumbnail: { width: 64, height: 80, backgroundColor: '#f3f4f6', borderRadius: 7 },
  reportDetails: { flex: 1 },
  reportName: { color: '#111827', fontSize: 14, fontWeight: '800' },
  reportMeta: { color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 3 },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 2 },
  removeText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  confirmCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 14, padding: 15 },
  deleteButton: { backgroundColor: '#b91c1c', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
});
