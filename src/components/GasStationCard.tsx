import { colors } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { preferredMapsApp } from '@/features/stations/preferences';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';

import type { FuelType, GasStation } from '@/types/stations';
import { priceDescription, reportStationPrice } from '@/features/stations/data';
import { formatFuelPrice } from '@/features/stations/logic';
import { appleMapsDirections, googleMapsDirections } from '@/features/stations/maps';

export function GasStationCard({
  station,
  fuelType,
  isCheapest,
  isDemo,
  now,
  canReport = false,
  canOpenMaps = false,
  canAddReceipt = false,
  onReported,
}: {
  station: GasStation;
  fuelType: FuelType;
  isCheapest?: boolean;
  isDemo: boolean;
  now: number;
  canReport?: boolean;
  canOpenMaps?: boolean;
  canAddReceipt?: boolean;
  onReported?: () => void;
}) {
  const mapsPreference = useSettingsStore((state) => state.mapsPreference);
  const mapsApp = preferredMapsApp(mapsPreference, Platform.OS);
  const price = station.prices.find((item) => item.fuelType === fuelType);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapsError, setMapsError] = useState('');

  async function openMap(url: string) {
    setMapsError('');
    try {
      await Linking.openURL(url);
    } catch {
      setMapsError('Could not open the maps app on this device.');
    }
  }

  async function submitPrice() {
    const value = Number(priceInput.trim());
    if (!/^\d+(?:\.\d{1,3})?$/.test(priceInput.trim()) || value <= 0 || value > 30) {
      setError('Enter a price from $0.001 to $30.000.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await reportStationPrice(station.id, fuelType, value);
      await queryClient.invalidateQueries({ queryKey: ['price-history', station.id, fuelType] });
      setEditing(false);
      setPriceInput('');
      onReported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this price.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, isCheapest && styles.cheapestCard]}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          {isCheapest && <Text style={styles.bestLabel}>BEST PRICE IN THIS LIST</Text>}
          <Text style={styles.name}>{station.name === 'Gas station' ? 'Name not listed' : station.name}</Text>
          <Text style={styles.address}>{station.address}</Text>
          <Text style={styles.meta}>{station.distanceMiles?.toFixed(1) ?? '?'} mi · {priceDescription(price, isDemo, now)}</Text>
          {station.attributions?.map((attribution, index) => attribution.providerUri ? (
            <Pressable key={`${attribution.provider}-${index}`} accessibilityRole="link" onPress={() => void Linking.openURL(attribution.providerUri!)}>
              <Text style={styles.attribution}>{attribution.provider} ↗</Text>
            </Pressable>
          ) : <Text key={`${attribution.provider}-${index}`} style={styles.attribution}>{attribution.provider}</Text>)}
        </View>

        <View style={styles.priceCol}>
          <Text style={[styles.price, !price && styles.examplePrice]}>{price ? formatFuelPrice(price.price) : '$9.99'}</Text>
          <Text style={styles.priceLabel}>/gal</Text>
          {!price && <Text style={styles.exampleTag}>EXAMPLE · NOT REAL</Text>}
        </View>
      </View>
      {canOpenMaps && <View style={styles.mapActions}>
        <Pressable accessibilityRole="button" style={styles.mapButton} onPress={() => void openMap(mapsApp === 'apple' ? appleMapsDirections(station) : googleMapsDirections(station))}><Text style={styles.mapButtonText}>{mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps'} ↗</Text></Pressable>
        {mapsError ? <Text style={styles.error}>{mapsError}</Text> : null}
      </View>}
      {canAddReceipt && <Link href={{ pathname: '/report-receipt', params: { stationId: station.id, stationName: station.name, stationAddress: station.address === 'Address not mapped' ? '' : station.address, latitude: String(station.latitude), longitude: String(station.longitude), fuelType } }} asChild><Pressable accessibilityRole="button" style={styles.receiptLink}><Text style={styles.editText}>Add receipt for this station ↗</Text></Pressable></Link>}
      {canAddReceipt && <Link href={{ pathname: '/report-price', params: { stationId: station.id, stationName: station.name === 'Gas station' ? 'Name not listed' : station.name, stationAddress: station.address === 'Address not mapped' ? '' : station.address, latitude: String(station.latitude), longitude: String(station.longitude), fuelType } }} asChild><Pressable accessibilityRole="button" style={styles.receiptLink}><Text style={styles.editText}>Report price without receipt ↗</Text></Pressable></Link>}
      {canAddReceipt && <Link href={{ pathname: '/price-history', params: { stationId: station.id, stationName: station.name === 'Gas station' ? 'Name not listed' : station.name, fuelType, source: 'local' } }} asChild><Pressable accessibilityRole="button" style={styles.receiptLink}><Text style={styles.editText}>View saved price history ↗</Text></Pressable></Link>}
      {canReport && (
        <View style={styles.reportArea}>
          <Link href={{ pathname: '/price-history', params: { stationId: station.id, stationName: station.name, fuelType } }} asChild><Pressable accessibilityRole="button" style={styles.historyLink}><Text style={styles.editText}>View price history ↗</Text></Pressable></Link>
          {editing ? <>
            <Text style={styles.reportNote}>Report the pump price you saw. This unverified price is shared with everyone using this API. No receipt photo is uploaded.</Text>
            <TextInput value={priceInput} onChangeText={setPriceInput} keyboardType="decimal-pad" placeholder="Price per gallon" accessibilityLabel={`${station.name} ${fuelType} price per gallon`} style={styles.input} maxLength={7} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.reportActions}>
              <Pressable accessibilityRole="button" onPress={() => void submitPrice()} disabled={saving} style={styles.reportButton}><Text style={styles.reportButtonText}>{saving ? 'Saving…' : 'Save price'}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setEditing(false); setError(''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            </View>
          </> : <Pressable accessibilityRole="button" onPress={() => setEditing(true)}><Text style={styles.editText}>Report a price ↗</Text></Pressable>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  receiptLink: { marginTop: 13, paddingVertical: 7, alignSelf: 'flex-start' },
  mapActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15, alignItems: 'center' },
  mapButton: { borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 6 },
  mapButtonText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  reportArea: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  historyLink: { marginBottom: 10 },
  reportNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 9 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, padding: 10, minHeight: 44, color: colors.ink },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  reportActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  reportButton: { backgroundColor: colors.accentDark, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 6 },
  reportButtonText: { color: colors.surface, fontWeight: '700' },
  cancelText: { color: colors.muted, fontWeight: '700' },
  editText: { color: colors.accentDark, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 17,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 7,
  },
  cheapestCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    backgroundColor: colors.paleOrange,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  textBlock: {
    flex: 1,
  },
  bestLabel: { color: colors.accentDark, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 7 },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  address: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  attribution: { marginTop: 5, color: colors.muted, fontSize: 12 },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.accentDark,
    fontVariant: ['tabular-nums'],
  },
  priceLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  examplePrice: { color: colors.muted },
  exampleTag: { marginTop: 4, color: colors.danger, fontSize: 9, fontWeight: '800', textAlign: 'right', maxWidth: 100 },
});
