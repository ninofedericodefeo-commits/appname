import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import AreaSearchSheet from '@/features/location/AreaSearchSheet';
import { useGasSearchStore } from '@/stores/gasSearchStore';
import { fetchOpenStreetMapStations } from '@/features/stations/overpass';
import type { GasStation } from '@/types/stations';
import { dataStyles as s } from '@/features/data/styles';
import Button from '@/features/subscriptions/SubscriptionButton';
export default function StationPicker({ onChoose, onClose }: { onChoose: (station: GasStation) => void; onClose: () => void }) {
  const { favorites, stationCaches, lastArea, chooseArea, saveStations } = useGasSearchStore();
  const [query, setQuery] = useState(''), [area, setArea] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const stations = useMemo(() => [...new Map([...favorites, ...stationCaches.flatMap(cache => cache.stations)].map(station => [station.id, station])).values()].filter(station => `${station.name} ${station.address}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30), [favorites, stationCaches, query]);
  async function search() {
    if (!lastArea) { setArea(true); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try { const result = await fetchOpenStreetMapStations({ ...lastArea, radius: 5, fuelType: 'regular', sortOrder: 'distance' }, controller.signal); if (!controller.signal.aborted) saveStations({ ...lastArea, radius: 5, fetchedAt: new Date().toISOString(), stations: result.stations }); }
    catch { if (!controller.signal.aborted) setError('Station search is unavailable. Choose a saved station or enter its address manually.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.safe}><FormScrollView contentContainerStyle={s.content}><View style={s.row}><Text style={s.heading}>Choose a station</Text><Button label="Close" onPress={onClose} /></View><Text style={s.note}>Pick the actual mapped station. Matching a name alone does not attach a price to its map pin.</Text><TextInput accessibilityLabel="Find a saved station" value={query} onChangeText={setQuery} placeholder="Station name or address" style={s.input} /><Text style={s.note}>{lastArea?.label ?? 'No search area chosen'}</Text><View style={s.row}><Button label="Choose area" onPress={() => setArea(true)} /><Button label={busy ? 'Searching…' : 'Find nearby stations'} disabled={busy} onPress={() => void search()} /></View>{!!error && <Text style={s.danger}>{error}</Text>}{stations.map(station => <View key={station.id} style={s.card}><Text style={s.heading}>{station.name}</Text><Text style={s.note}>{station.address || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}</Text><Button label="Use this station" accessibilityLabel={`Use ${station.name} at ${station.address}`} onPress={() => { request.current?.abort(); onChoose(station); onClose(); }} /></View>)}{!stations.length && <Text style={s.note}>No saved stations match. Choose an area and search, or enter the station address in the report.</Text>}</FormScrollView>{area && <AreaSearchSheet onChoose={chooseArea} onClose={() => setArea(false)} />}</SafeAreaView></Modal>;
}
