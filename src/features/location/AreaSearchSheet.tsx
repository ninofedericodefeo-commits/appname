import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { colors } from '@/theme';
import { areaKey, coordinateArea, coordinateLabel, fetchPlaceMatches, placeQueryKey } from './areaSearch';
import type { PlaceMatch, SearchArea } from './areaSearch';

export default function AreaSearchSheet({ onChoose, onClose }: { onChoose: (area: SearchArea) => void; onClose: () => void }) {
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
  return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><Text style={styles.title}>Search an area</Text><SubscriptionButton label="Close" onPress={close} /></View>
    <FormScrollView contentContainerStyle={styles.form}>
      <Text style={styles.label}>City, ZIP, address or latitude, longitude</Text>
      <TextInput accessibilityLabel="Gas search area" style={styles.input} value={query} maxLength={200} placeholder="Philadelphia, PA" autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => void search()} onChangeText={value => { current.current?.abort(); setQuery(value); setMatches([]); setMessage(''); setUsingSaved(false); setBusy(false); }} />
      <SubscriptionButton label={busy ? 'Finding places…' : 'Find area'} tone="primary" disabled={busy || query.trim().length < 2} onPress={() => void search()} />
      <Text style={styles.note}>Place search sends only the text you submit to Photon. GPS permission is not needed. Coordinates and saved areas work without place lookup.</Text>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
      {usingSaved && <SubscriptionButton label="Search online again" disabled={busy} onPress={() => void search(true)} />}
      {!!matches.length && <><Text style={styles.label}>Choose a place</Text>{matches.map(item => <View key={`${areaKey(item)}:${item.label}`} style={styles.match}><SubscriptionButton label={item.label} accessibilityLabel={`Search near ${item.label} at ${coordinateLabel(item)}`} onPress={() => choose(item)} /><Text style={styles.note}>{coordinateLabel(item)}</Text></View>)}</>}
      {!!recentAreas.length && <><Text style={styles.label}>Recent areas</Text>{recentAreas.map(item => <SubscriptionButton key={areaKey(item)} label={item.label} accessibilityLabel={`Use recent area ${item.label}`} onPress={() => choose(item)} />)}</>}
      {!!favorites.length && <><Text style={styles.label}>Saved stations</Text>{favorites.map(station => <View key={station.id} style={styles.saved}><Text style={styles.label}>{station.name}</Text><Text style={styles.note}>{station.address || coordinateLabel(station)}</Text><SubscriptionButton label="Search around this station" accessibilityLabel={`Search around saved station ${station.name}`} onPress={() => choose({ latitude: station.latitude, longitude: station.longitude, label: station.name, kind: 'place' })} /><SubscriptionButton label="Unsave station" accessibilityLabel={`Unsave station ${station.name}`} onPress={() => useGasSearchStore.getState().toggleFavorite(station)} /></View>)}</>}
      <Text style={styles.note}>Place data © OpenStreetMap contributors · Photon by komoot. Prices are separate reports.</Text>
    </FormScrollView>
  </SafeAreaView></Modal>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.line }, title: { flex: 1, fontSize: 24, color: colors.ink, fontWeight: '800' }, form: { padding: 20, gap: 14, paddingBottom: 40 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, paddingHorizontal: 12, color: colors.ink, fontSize: 16, backgroundColor: colors.surface }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, match: { gap: 5 }, saved: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10, gap: 8 } });
