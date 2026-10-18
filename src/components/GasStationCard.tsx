import { themedStyles, useThemeRevision, colors } from '@/theme';
import { AppIcon } from '@/components/AppIcon';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { preferredMapsApp } from '@/features/stations/preferences';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';

import type { FuelType, GasStation } from '@/types/stations';
import { priceDescription, reportStationPrice } from '@/features/stations/data';
import { formatFuelPrice, isRecentPrice } from '@/features/stations/logic';
import { appleMapsDirections, googleMapsDirections } from '@/features/stations/maps';
import { webUrl } from '@/lib/webUrl';

export function GasStationCard({
  station,
  fuelType,
  isCheapest,
  isDemo,
  now,
  canReport = false,
  canOpenMaps = false,
  canAddReceipt = false,
  canFavorite = false,
  distanceLabel,
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
  canFavorite?: boolean;
  distanceLabel?: string;
  onReported?: () => void;
}) {
  useThemeRevision();
  const { width, fontScale } = useWindowDimensions();
  const stackPrice = fontScale >= 1.4 || width < 360;
  const priceQualifier = useSettingsStore(state => state.priceQualifier);
  const mapsPreference = useSettingsStore((state) => state.mapsPreference);
  const favorites = useGasSearchStore(state => state.favorites);
  const favorite = favorites.some(item => item.id === station.id);
  const mapsApp = preferredMapsApp(mapsPreference, Platform.OS);
  const stationLabel = `${station.name}, ${station.address}`;
  const price = station.prices.find((item) => item.fuelType === fuelType);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lowestRecent = isCheapest && !isDemo && isRecentPrice(price, now);
  const hasDetails = canAddReceipt || canReport;
  const stationName = station.name === 'Gas station' ? 'Name not listed' : station.name;
  const paymentLabel = price?.qualifier && price.qualifier !== 'standard'
    ? `${price.qualifier === 'member' ? 'Member' : price.qualifier === 'cash' ? 'Cash' : 'Card'} price`
    : '';

  async function openMap(url: string, errorMessage = 'Could not open the maps app on this device.') {
    setMapsError('');
    try {
      const destination = webUrl(url);
      if (!destination) throw new Error('Unsupported website address.');
      await Linking.openURL(destination);
    } catch {
      setMapsError(errorMessage);
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
    <View style={[styles.card, lowestRecent && styles.cheapestCard]}>
      {lowestRecent && <View style={styles.bestBadge}><AppIcon name="check" size={13} color={colors.success} /><Text style={styles.bestLabel}>Lowest recent report</Text></View>}
      <View style={[styles.row, stackPrice && styles.stackedRow]}>
        <View style={styles.textBlock}>
          <Text accessibilityRole="header" style={styles.name}>{stationName}</Text>
          <Text style={styles.address}>{station.address}</Text>
          <Text style={styles.distance}>{station.distanceMiles?.toFixed(1) ?? '?'} mi{distanceLabel ? ` ${distanceLabel}` : ''}</Text>
        </View>

        <View accessible accessibilityLabel={`${fuelType}: ${price ? `${formatFuelPrice(price.price)} per gallon${paymentLabel ? `, ${paymentLabel}` : ''}` : 'Price unavailable'}`} style={[styles.priceCol, stackPrice && styles.stackedPrice]}>
          <Text style={[styles.price, !price && styles.unknownPrice, lowestRecent && styles.lowestPrice]}>{price ? formatFuelPrice(price.price) : 'N/A'}</Text>
          <Text style={styles.priceLabel}>{price ? '/ gallon' : 'No report'}</Text>
          {paymentLabel ? <Text style={styles.paymentLabel}>{paymentLabel}</Text> : null}
        </View>
      </View>
      <Text style={styles.meta}>{priceDescription(price, isDemo, now)}</Text>
      {(canOpenMaps || canFavorite || hasDetails) && <View style={styles.actions}>
        {canOpenMaps && <Pressable accessibilityRole="button" accessibilityLabel={`Directions to ${stationLabel} in ${mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps'}`} style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]} onPress={() => void openMap(mapsApp === 'apple' ? appleMapsDirections(station) : googleMapsDirections(station))}><AppIcon name="arrow-up-right" size={17} color={colors.onPrimary} /><Text style={styles.mapButtonText}>Directions</Text></Pressable>}
        {hasDetails && <Pressable accessibilityRole="button" accessibilityLabel={`${detailsOpen ? 'Hide' : 'Show'} details for ${stationLabel}`} accessibilityState={{ expanded: detailsOpen }} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]} onPress={() => setDetailsOpen(value => !value)}><Text style={styles.editText}>Details</Text><AppIcon name={detailsOpen ? 'chevron-down' : 'chevron-right'} size={16} color={colors.accentDark} /></Pressable>}
        {canFavorite && <Pressable accessibilityRole="button" accessibilityLabel={`${favorite ? 'Unsave' : 'Save'} station ${station.name}`} accessibilityState={{ selected: favorite }} style={({ pressed }) => [styles.favoriteButton, favorite && styles.favoriteSelected, pressed && styles.pressed]} onPress={() => { if (!favorite && favorites.length >= 50) { setMapsError('You can save up to 50 stations. Unsave one to add another.'); return; } useGasSearchStore.getState().toggleFavorite(station); setMapsError(''); }}><AppIcon name={favorite ? 'bookmark-filled' : 'bookmark'} size={21} color={colors.accentDark} /></Pressable>}
      </View>}
      {mapsError ? <Text accessibilityRole="alert" style={styles.error}>{mapsError}</Text> : null}
      {station.attributions?.map((attribution, index) => attribution.providerUri ? (
        <Pressable key={`${attribution.provider}-${index}`} accessibilityRole="link" accessibilityLabel={`${attribution.provider} attribution`} onPress={() => void openMap(attribution.providerUri!, 'Could not open the attribution link. Try again.')} style={styles.attributionLink}>
          <Text style={styles.attribution}>{attribution.provider} ↗</Text>
        </Pressable>
      ) : <Text key={`${attribution.provider}-${index}`} style={styles.attribution}>{attribution.provider}</Text>)}
      {detailsOpen && <View style={styles.detailsArea}>
      {canAddReceipt && <Link href={{ pathname: '/report-price', params: { stationId: station.id, stationName, stationAddress: station.address === 'Address not mapped' ? '' : station.address, latitude: String(station.latitude), longitude: String(station.longitude), fuelType } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Report ${fuelType} price or refill at ${stationLabel}`} style={styles.detailLink}><AppIcon name="plus" size={18} color={colors.accentDark} /><Text style={styles.editText}>Report price or refill</Text><AppIcon name="chevron-right" size={16} color={colors.muted} /></Pressable></Link>}
      {canAddReceipt && <Link href={{ pathname: '/price-history', params: { stationId: station.id, stationName, fuelType, qualifier: priceQualifier, source: 'local' } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`View saved ${fuelType} price history for ${stationLabel}`} style={styles.detailLink}><AppIcon name="chart" size={18} color={colors.accentDark} /><Text style={styles.editText}>Saved price history</Text><AppIcon name="chevron-right" size={16} color={colors.muted} /></Pressable></Link>}
      {canReport && (
        <View style={styles.reportArea}>
          <Link href={{ pathname: '/price-history', params: { stationId: station.id, stationName: station.name, fuelType } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`View ${fuelType} price history for ${stationLabel}`} style={styles.detailLink}><AppIcon name="chart" size={18} color={colors.accentDark} /><Text style={styles.editText}>Price history</Text><AppIcon name="chevron-right" size={16} color={colors.muted} /></Pressable></Link>
          {editing ? <>
            <Text style={styles.reportNote}>Enter the pump price you saw. This unverified report is shared with everyone using this API. No receipt photo is uploaded.</Text>
            <Text style={styles.fieldLabel}>Price per gallon ($)</Text>
            <TextInput value={priceInput} onChangeText={value => { setPriceInput(value); setError(''); }} keyboardType="decimal-pad" placeholder="0.000" placeholderTextColor={colors.muted} accessibilityLabel={`${station.name} ${fuelType} price per gallon in dollars`} style={styles.input} maxLength={7} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.reportActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Save ${fuelType} price for ${stationLabel}`} accessibilityState={{ disabled: saving, busy: saving }} onPress={() => void submitPrice()} disabled={saving} style={styles.reportButton}><Text style={styles.reportButtonText}>{saving ? 'Saving…' : 'Save price'}</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => { setEditing(false); setError(''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            </View>
          </> : <Pressable accessibilityRole="button" accessibilityLabel={`Report ${fuelType} price for ${stationLabel}`} accessibilityState={{ expanded: false }} style={styles.detailLink} onPress={() => setEditing(true)}><AppIcon name="plus" size={18} color={colors.accentDark} /><Text style={styles.editText}>Report a price</Text></Pressable>}
        </View>
      )}
      </View>}
    </View>
  );
}

const styles = themedStyles(() => ({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  mapButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  mapButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
  detailsButton: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 3, paddingHorizontal: 8 },
  favoriteButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 'auto', borderRadius: 12 },
  favoriteSelected: { backgroundColor: colors.tint },
  pressed: { opacity: 0.65 },
  detailsArea: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.line },
  detailLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  reportArea: { gap: 6 },
  reportNote: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 8 },
  fieldLabel: { color: colors.inkSoft, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, padding: 12, minHeight: 48, fontSize: 17, color: colors.ink, backgroundColor: colors.paper },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 6 },
  reportActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 8 },
  reportButton: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  reportButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText: { color: colors.accentDark, fontSize: 15, fontWeight: '600' },
  editText: { color: colors.accentDark, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  cheapestCard: {
    borderColor: colors.success,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  stackedRow: { flexDirection: 'column', alignItems: 'stretch' },
  stackedPrice: { alignItems: 'flex-start' },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  bestBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.successPale, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  bestLabel: { color: colors.success, fontSize: 12, fontWeight: '600' },
  name: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: colors.ink,
  },
  address: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  distance: { marginTop: 5, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  attributionLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  attribution: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  unknownPrice: { color: colors.muted, fontSize: 23 },
  lowestPrice: { color: colors.success },
  priceLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  paymentLabel: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
}));
