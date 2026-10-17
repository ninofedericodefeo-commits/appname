import { useReducedMotion } from '@/components/useReducedMotion';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { areaKey, coordinateArea, coordinateLabel, fetchPlaceMatches, placeQueryKey } from './areaSearch';
import type { PlaceMatch, SearchArea } from './areaSearch';

export default function AreaSearchSheet({ onChoose, onClose }: { onChoose: (area: SearchArea) => void; onClose: () => void }) {
  useThemeRevision();
  const reduced = useReducedMotion();
  const { recentAreas, favorites } = useGasSearchStore();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [usingSaved, setUsingSaved] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  function close() { current.current?.abort(); Keyboard.dismiss(); onClose(); }
  function choose(area: SearchArea) { current.current?.abort(); Keyboard.dismiss(); onChoose(area); onClose(); }
  async function search(refresh = false) {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setBusy(true); setMessage(''); setMatches([]); setUsingSaved(false); Keyboard.dismiss();
    try {
      const direct = coordinateArea(query);
      if (direct) { choose(direct); return; }
      const saved = !refresh && useGasSearchStore.getState().placeCaches.find(item => item.query === placeQueryKey(query));
      if (saved) { setMatches(saved.matches); setUsingSaved(true); setMessage(saved.matches.length ? `Saved places from ${new Date(saved.fetchedAt).toLocaleDateString()}.` : 'No saved places match. Try a fuller address, coordinates, or search online again.'); }
      else {
        const found = await fetchPlaceMatches(query, controller.signal, Platform.OS !== 'web', process.env.EXPO_PUBLIC_PLACE_SEARCH_URL || undefined);
        if (controller.signal.aborted) return;
        useGasSearchStore.getState().savePlaces(query, found); setMatches(found);
        if (!found.length) setMessage('No places found. Try a city and state, ZIP code, or coordinates.');
      }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Place search unavailable. Choose a saved area or enter coordinates.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <Modal visible animationType={reduced ? 'none' : 'slide'} onRequestClose={close}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Search an area</Text><SubscriptionButton label="Close" onPress={close} /></View>
    <FormScrollView contentContainerStyle={styles.form}>
      <Text style={styles.label}>City, ZIP, address or coordinates</Text>
      <TextInput accessibilityLabel="Gas search area" style={styles.input} value={query} maxLength={200} placeholder="City or ZIP code" placeholderTextColor={colors.muted} autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => void search()} onChangeText={value => { current.current?.abort(); setQuery(value); setMatches([]); setMessage(''); setUsingSaved(false); setBusy(false); }} />
      <SubscriptionButton label={busy ? 'Finding places…' : 'Find area'} tone="primary" disabled={busy || query.trim().length < 2} onPress={() => void search()} />
      <Text style={styles.note}>Search text is sent to Photon. Coordinates and saved areas work offline.</Text>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
      {usingSaved && <SubscriptionButton label="Search online again" disabled={busy} onPress={() => void search(true)} />}
      {!!matches.length && <><Text style={styles.label}>Choose a place</Text>{matches.map(item => <View key={`${areaKey(item)}:${item.label}`} style={styles.match}><SubscriptionButton label={item.label} accessibilityLabel={`Search near ${item.label} at ${coordinateLabel(item)}`} onPress={() => choose(item)} /><Text style={styles.note}>{coordinateLabel(item)}</Text></View>)}</>}
      {!!recentAreas.length && <><Text style={styles.label}>Recent areas</Text>{recentAreas.map(item => <SubscriptionButton key={areaKey(item)} label={item.label} accessibilityLabel={`Use recent area ${item.label}`} onPress={() => choose(item)} />)}</>}
      {!!favorites.length && <><Text style={styles.label}>Saved stations</Text>{favorites.map(station => <View key={station.id} style={styles.saved}><Text style={styles.label}>{station.name}</Text><Text style={styles.note}>{station.address || coordinateLabel(station)}</Text><SubscriptionButton label="Search around this station" accessibilityLabel={`Search around saved station ${station.name}`} onPress={() => choose({ latitude: station.latitude, longitude: station.longitude, label: station.name, kind: 'place' })} /><SubscriptionButton label="Unsave station" accessibilityLabel={`Unsave station ${station.name}`} onPress={() => useGasSearchStore.getState().toggleFavorite(station)} /></View>)}</>}
      <Text style={styles.note}>Place data © OpenStreetMap contributors · Photon by komoot. Prices are separate reports.</Text>
    </FormScrollView>
  </SafeAreaView></Modal>;
}
const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: colors.ink, fontWeight: '700' },
  form: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 16, paddingBottom: 40 },
  label: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  input: { minHeight: 52, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: colors.ink, fontSize: 17, backgroundColor: colors.surface },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, match: { gap: 5 },
  saved: { padding: 16, backgroundColor: colors.surface, borderRadius: 16, gap: 8 },
}));
