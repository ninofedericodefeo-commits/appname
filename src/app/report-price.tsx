import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { CalendarDateField } from '@/components/CalendarDateField';
import StationPicker from '@/features/fuel/StationPicker';
import { parseFuelDetails, priceQualifiers, receiptAccountCandidates, reportAccountTransaction } from '@/features/fuel/logic';
import type { PriceQualifier, FuelPurchaseDetails } from '@/types/fuelReports';
import { saveReceiptPhoto, deleteReceiptPhoto } from '@/features/receipts/photoStorage';
import ReceiptOcrReview from '@/features/receipts/ReceiptOcrReview';
import ReceiptPhoto from '@/features/receipts/ReceiptPhoto';
import { getCurrentLocation, requestLocationPermission } from '@/features/location/permissions';
import { pocketTransactions, transactionDisplayName } from '@/features/pocket/transactions';
import { belongsToLinkedAccount } from '@/features/pocket/balanceEstimate';
import { localDateKey } from '@/features/subscriptions/logic';
import { recoverableBankOperation } from '@/features/data/backupService';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { usePocketStore } from '@/stores/pocketStore';
import { useDriveStore } from '@/stores/driveStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FuelType } from '@/types/stations';
import { formatAmount, formatMoney } from '@/lib/money';
import { parseDollars } from '@/features/pocket/logic';
import { dataStyles as s } from '@/features/data/styles';
import Button from '@/features/subscriptions/SubscriptionButton';

const fuels: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];
export default function ReportPriceScreen() {
  const params = useLocalSearchParams<{ reportId?: string; receiptId?: string; stationId?: string; stationName?: string; stationAddress?: string; latitude?: string; longitude?: string; fuelType?: FuelType }>();
  const savedPrice = usePriceReportStore(state => state.reports.find(report => report.id === params.reportId));
  const savedReceipt = useReceiptStore(state => state.reports.find(report => report.id === params.receiptId));
  const saved = savedReceipt ?? savedPrice, pocket = usePocketStore(), { cars, selectedCarId } = useDriveStore();
  const settings = useSettingsStore();
  const [draftId] = useState(() => `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`), id = saved?.id ?? draftId;
  const [stationId, setStationId] = useState(saved?.stationId ?? params.stationId);
  const [stationName, setStationName] = useState(saved?.stationName ?? params.stationName ?? ''), [stationAddress, setStationAddress] = useState(saved?.stationAddress ?? params.stationAddress ?? '');
  const [latitude, setLatitude] = useState(savedReceipt?.coordinates ? String(savedReceipt.coordinates.latitude) : savedPrice ? String(savedPrice.latitude) : params.latitude ?? '');
  const [longitude, setLongitude] = useState(savedReceipt?.coordinates ? String(savedReceipt.coordinates.longitude) : savedPrice ? String(savedPrice.longitude) : params.longitude ?? '');
  const [fuelType, setFuelType] = useState<FuelType>(saved?.fuelType ?? (params.fuelType && fuels.includes(params.fuelType) ? params.fuelType : settings.selectedFuelType));
  const [price, setPrice] = useState(savedReceipt ? String(savedReceipt.pricePerGallon) : savedPrice ? String(savedPrice.price) : '');
  const [qualifier, setQualifier] = useState<PriceQualifier>(saved?.priceQualifier ?? settings.priceQualifier);
  const [gallons, setGallons] = useState(saved?.gallons === undefined ? '' : String(saved.gallons));
  const [total, setTotal] = useState(saved?.totalCents !== undefined ? formatAmount(saved.totalCents).replaceAll(',', '') : savedReceipt?.total !== undefined ? savedReceipt.total.toFixed(2) : '');
  const initialDate = saved?.observedAt ?? savedReceipt?.purchasedOn ?? savedPrice?.reportedAt;
  const [observedOn, setObservedOn] = useState(initialDate ? initialDate.length === 10 ? initialDate : localDateKey(new Date(initialDate)) : localDateKey(new Date()));
  const [observedTime, setObservedTime] = useState(() => { const date = initialDate ? new Date(initialDate.length === 10 ? `${initialDate}T12:00:00` : initialDate) : new Date(); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; });
  const [carId, setCarId] = useState(saved?.carId ?? selectedCarId ?? ''), [odometer, setOdometer] = useState(saved?.odometerMiles === undefined ? '' : String(saved.odometerMiles));
  const [fullFill, setFullFill] = useState(saved?.fullFill ?? false), [completeFillInterval, setCompleteFillInterval] = useState(saved?.completeFillInterval ?? false);
  const [acknowledgeAdjustment, setAcknowledgeAdjustment] = useState(false), [linkDifference, setLinkDifference] = useState(false), [confirmNew, setConfirmNew] = useState(false), [applyRule, setApplyRule] = useState(false);
  const [photoUri, setPhotoUri] = useState(saved?.photoUri ?? ''), [photo, setPhoto] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [picker, setPicker] = useState(false), [locationDetails, setLocationDetails] = useState(false), [refill, setRefill] = useState(!!(saved?.gallons || saved?.totalCents || savedReceipt?.total || saved?.photoUri));
  const [linkMode, setLinkMode] = useState<'none' | 'existing' | 'new'>(saved?.accountLink ? 'existing' : 'none');
  const [accountLink, setAccountLink] = useState<FuelPurchaseDetails['accountLink']>(saved?.accountLink);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const rows = useMemo(() => pocketTransactions(pocket.accountTransactions, pocket.purchases, [], [], pocket.transactionDirections).filter(row => belongsToLinkedAccount(row, pocket.linkedBankAccount)), [pocket.accountTransactions, pocket.purchases, pocket.transactionDirections, pocket.linkedBankAccount]);
  const candidates = receiptAccountCandidates(rows, parseDollars(total) ?? undefined, `${observedOn}T12:00:00`);
  const selectedRow = reportAccountTransaction({ accountLink }, rows);
  useEffect(() => { void ImagePicker.getPendingResultAsync().then(result => { if (result && 'canceled' in result && !result.canceled && result.assets?.[0]) { setPhoto(result.assets[0]); setRefill(true); } }).catch(() => undefined); }, []);
  async function choosePhoto(camera: boolean) {
    setError('');
    try {
      if (camera && Platform.OS !== 'web' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera access is off. Choose a photo instead.');
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .7, allowsEditing: true }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .7, allowsEditing: true });
      if (!result.canceled && result.assets[0]) { if ((result.assets[0].fileSize ?? 0) > 10 * 1024 * 1024) throw new Error('Choose a receipt photo under 10 MB.'); setPhoto(result.assets[0]); setRefill(true); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not choose a photo.'); }
  }
  async function locate() {
    setBusy(true); setError('');
    try { if (!await requestLocationPermission()) throw new Error('Location is off. Choose a mapped station or enter its address.'); const point = await getCurrentLocation(); setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); setStationId(undefined); setLocationDetails(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Location is unavailable.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (busy) return;
    setError(''); setBusy(true); let newPhotoUri = '';
    try {
      const parsed = parseFuelDetails({ stationName, stationAddress, latitude, longitude, price, gallons, total, observedOn, observedTime, qualifier, odometer, fullFill, completeFillInterval, acknowledgeAdjustment });
      if (savedPrice && !parsed.coordinates) throw new Error('Keep a valid station location for this existing price report.');
      if (linkMode !== 'none' && !parsed.totalCents) throw new Error('Add the actual refill total before linking to Account.');
      if (linkMode === 'existing' && !selectedRow) throw new Error('Choose the existing Account charge to link.');
      if (selectedRow && linkMode === 'existing' && -selectedRow.amountCents !== parsed.totalCents && !linkDifference) throw new Error('The receipt and Account amounts differ. Check the selected charge and confirm the difference.');
      if (linkMode === 'new' && candidates.length && !confirmNew) throw new Error('Similar charges are already saved. Link one, or confirm that this is a separate refill.');
      if (photo) newPhotoUri = await saveReceiptPhoto(photo.uri, id, photo.mimeType);
      await recoverableBankOperation(async permit => {
        let link = linkMode === 'existing' ? accountLink : undefined;
        if (linkMode === 'new') {
          const purchaseId = `fuel-purchase-${id}`;
          if (!permit(() => usePocketStore.getState().addPurchase(purchaseId, parsed.stationName.slice(0, 80), parsed.totalCents!, undefined, 'manual', parsed.observedAt, applyRule))) throw new Error('A purchase for this report is already saved. Link the existing charge instead.');
          link = { kind: 'purchase', id: purchaseId };
        }
        if (linkMode === 'existing') {
          const current = usePocketStore.getState(), liveRows = pocketTransactions(current.accountTransactions, current.purchases, [], [], current.transactionDirections);
          const live = reportAccountTransaction({ accountLink }, liveRows);
          if (!live || live.amountCents !== selectedRow?.amountCents) throw new Error('The selected Account charge changed. Review it again.');
        }
        const linkedId = linkMode === 'new' ? link?.id : linkMode === 'existing' ? selectedRow?.id : undefined;
        if (linkedId && !usePocketStore.getState().transactionDetails[linkedId]) permit(() => usePocketStore.getState().editTransactionDetails(linkedId, { merchant: '', category: 'Gas', classification: 'ordinary', note: '' }, false));
        const details = { ...parsed, accountLink: link, carId: (parsed.gallons !== undefined || parsed.totalCents !== undefined || parsed.odometerMiles !== undefined) ? carId || undefined : undefined, photoUri: newPhotoUri || photoUri };
        if (savedPrice) permit(() => usePriceReportStore.getState().saveReport({ ...savedPrice, ...details, fuelType, price: parsed.pricePerGallon, latitude: parsed.coordinates!.latitude, longitude: parsed.coordinates!.longitude, stationId, reportedAt: parsed.observedAt }));
        else permit(() => useReceiptStore.getState().saveReport({ ...savedReceipt, ...details, id, stationId, fuelType, locationSource: stationId ? 'map' : 'entered', savedAt: savedReceipt?.savedAt ?? new Date().toISOString() }));
      });
      router.replace('/report-receipt');
    } catch (cause) { if (newPhotoUri) { try { await deleteReceiptPhoto(newPhotoUri); } catch { /* Retain a staged photo when recovery still owns the data lock. */ } } setError(cause instanceof Error ? cause.message : 'Could not save this report. Your draft is still here.'); }
    finally { setBusy(false); }
  }
  const check = (label: string, value: boolean, change: (value: boolean) => void) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} aria-checked={value} style={[s.choice, value && s.selected]} onPress={() => change(!value)}><Text style={s.choiceText}>{value ? '✓ ' : ''}{label}</Text></Pressable>;
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={s.safe}><Stack.Screen options={{ title: 'Fuel report' }} /><FormScrollView contentContainerStyle={s.content}>
    <Text style={s.title}>{saved ? 'Edit fuel report' : 'Price or refill'}</Text><Text style={s.note}>Record an observed price, with an optional refill and photo. Reports stay on this device.</Text>
    <View style={s.card}><Text style={s.heading}>Station</Text>{stationId && <Text style={s.note}>Linked to the selected map station.</Text>}<Button label="Choose mapped or saved station" onPress={() => setPicker(true)} /><TextInput accessibilityLabel="Station name" placeholder="Station name" value={stationName} onChangeText={value => { setStationName(value); setStationId(undefined); }} style={s.input} maxLength={120} /><TextInput accessibilityLabel="Station address" placeholder="Address" value={stationAddress} onChangeText={value => { setStationAddress(value); setStationId(undefined); }} style={s.input} maxLength={180} /><View style={s.row}><Button label="Use current location" disabled={busy} onPress={() => void locate()} /><Button label={locationDetails ? 'Hide coordinates' : 'Enter coordinates'} onPress={() => setLocationDetails(!locationDetails)} /></View>{locationDetails && <><TextInput accessibilityLabel="Latitude" placeholder="Latitude" value={latitude} onChangeText={value => { setLatitude(value); setStationId(undefined); }} style={s.input} keyboardType="numbers-and-punctuation" /><TextInput accessibilityLabel="Longitude" placeholder="Longitude" value={longitude} onChangeText={value => { setLongitude(value); setStationId(undefined); }} style={s.input} keyboardType="numbers-and-punctuation" /><Text style={s.note}>Coordinates place your report on the map. Only selecting a mapped station attaches it to that station’s existing pin.</Text></>}</View>
    <View style={s.card}><Text style={s.heading}>Observed price</Text><TextInput accessibilityLabel="Price per gallon" placeholder="USD per gallon · 3.199" value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={s.input} /><View style={s.row}>{fuels.map(value => <Button key={value} label={value} tone={fuelType === value ? 'primary' : 'secondary'} onPress={() => setFuelType(value)} />)}</View><View style={s.row}>{priceQualifiers.map(value => <Button key={value.id} label={value.label} tone={qualifier === value.id ? 'primary' : 'secondary'} onPress={() => setQualifier(value.id)} />)}</View><Text style={s.note}>Gas search and trip comparisons use the price type selected in Filters.</Text><CalendarDateField label="Price observed on" value={observedOn} maximumDate={localDateKey(new Date())} onChange={setObservedOn} /><TextInput accessibilityLabel="Observation time" placeholder="Time observed · HH:MM" value={observedTime} onChangeText={setObservedTime} keyboardType="numbers-and-punctuation" style={s.input} maxLength={5} /></View>
    <View style={s.card}><Button label={refill ? 'Hide refill details' : 'Add refill details or receipt'} onPress={() => setRefill(!refill)} />{refill && <><TextInput accessibilityLabel="Gallons purchased" placeholder="Gallons · optional" value={gallons} onChangeText={setGallons} keyboardType="decimal-pad" style={s.input} /><TextInput accessibilityLabel="Refill total" placeholder="Actual total · optional" value={total} onChangeText={setTotal} keyboardType="decimal-pad" style={s.input} />{check('I checked any fees, discounts or difference in the total', acknowledgeAdjustment, setAcknowledgeAdjustment)}<Text style={s.note}>Differences over $0.10 require this check; the exact difference is retained.</Text><View style={s.row}><Button label="Choose receipt photo" onPress={() => void choosePhoto(false)} />{Platform.OS !== 'web' && <Button label="Take photo" onPress={() => void choosePhoto(true)} />}</View><Text style={s.note}>Use a cropped copy to leave out payment details. Photos are optional and can be removed from this report.</Text>{photo ? <Image source={{ uri: photo.uri }} resizeMode="contain" style={{ height: 220, width: '100%' }} accessibilityLabel="Selected receipt preview" /> : !!photoUri && <ReceiptPhoto uri={photoUri} label="Saved receipt" />}{(photo || photoUri) && <ReceiptOcrReview key={photo?.uri ?? photoUri} uri={photo?.uri ?? photoUri} current={{ stationName, price, gallons, total, observedOn, fuelType }} onApply={values => { if (values.stationName) { setStationName(values.stationName); setStationId(undefined); } if (values.price) setPrice(values.price); if (values.gallons) setGallons(values.gallons); if (values.total) setTotal(values.total); if (values.observedOn) setObservedOn(values.observedOn); if (values.fuelType && fuels.includes(values.fuelType as FuelType)) setFuelType(values.fuelType as FuelType); }} />}{(photo || photoUri) && <Button label="Remove photo from report" onPress={() => { setPhoto(null); setPhotoUri(''); }} />}{!!cars.length && <><Text style={s.body}>Car · optional</Text><View style={s.row}><Button label="No car" tone={!carId ? 'primary' : 'secondary'} onPress={() => setCarId('')} />{cars.map(car => <Button key={car.id} label={car.name} tone={carId === car.id ? 'primary' : 'secondary'} onPress={() => setCarId(car.id)} />)}</View>{carId && <><TextInput accessibilityLabel="Odometer miles" placeholder="Odometer miles · optional" value={odometer} onChangeText={setOdometer} style={s.input} keyboardType="decimal-pad" />{check('Filled the tank completely', fullFill, value => { setFullFill(value); if (!value) setCompleteFillInterval(false); })}{fullFill && check('Every fill since the previous full tank is logged', completeFillInterval, setCompleteFillInterval)}</>}</>}
      <Text style={s.heading}>Account · optional</Text><Text style={s.note}>Link an existing charge to keep one financial record. Logging a new purchase can update the account estimate. Unlinking a report leaves its Account transaction saved.</Text><View style={s.row}>{(['none', 'existing', 'new'] as const).map(value => <Button key={value} label={value === 'none' ? 'Report only' : value === 'existing' ? 'Link charge' : 'Log new purchase'} tone={linkMode === value ? 'primary' : 'secondary'} onPress={() => setLinkMode(value)} />)}</View>
      {linkMode === 'existing' && <>{selectedRow && <Text style={s.body}>Selected: {transactionDisplayName(selectedRow)} · {formatMoney(-selectedRow.amountCents)}</Text>}{candidates.map(row => <Button key={row.id} label={`${transactionDisplayName(row)} · ${formatMoney(-row.amountCents)} · ${new Date(row.occurredAt).toLocaleDateString()}`} tone={selectedRow?.id === row.id ? 'primary' : 'secondary'} onPress={() => setAccountLink({ kind: ['csv', 'citizens-pdf'].includes(row.source) ? 'transaction' : 'purchase', id: row.id })} />)}{!candidates.length && <Text style={s.note}>Enter the refill total and date to find similar charges within seven days. Choose a charge only after checking it.</Text>}{check('I checked any difference from the Account charge', linkDifference, setLinkDifference)}</>}
      {linkMode === 'new' && <>{!!candidates.length && check('This is another refill, separate from similar saved charges', confirmNew, setConfirmNew)}{pocket.activeGoal && check('Apply my goal’s set-aside rule to this purchase', applyRule, setApplyRule)}<Text style={s.note}>A future statement can match this logged purchase after review. A pending gas authorization is not the final refill charge.</Text></>}
    </>}</View>
    {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}{busy && <ActivityIndicator />}<Button label={busy ? 'Saving…' : 'Save fuel report'} disabled={busy} tone="primary" onPress={() => void save()} />
  </FormScrollView>{picker && <StationPicker onClose={() => setPicker(false)} onChoose={station => { setStationId(station.id); setStationName(station.name); setStationAddress(station.address); setLatitude(String(station.latitude)); setLongitude(String(station.longitude)); }} />}</SafeAreaView>;
}
