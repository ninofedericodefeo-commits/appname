import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import catalog from '@/features/vehicles/catalog.json';
import { estimatedTankGallons, newCarId } from '@/features/vehicles/logic';
import type { CarProfile } from '@/features/vehicles/logic';
import { useDriveStore } from '@/stores/driveStore';
import { colors } from '@/theme';

const popular = ['Subaru Crosstrek', 'Toyota RAV4', 'Honda CR-V', 'Toyota Corolla', 'Honda Civic', 'Ford F150'];
export default function CarsScreen() {
  const { cars, saveCar, deleteCar } = useDriveStore();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CarProfile | null>(null);
  const [mpg, setMpg] = useState('');
  const [tank, setTank] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const matches = useMemo(() => {
    const terms = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
    return catalog.vehicles.filter((car) => terms.length ? terms.every((term) => car.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(term)) : popular.includes(car.name)).slice(0, 12);
  }, [query]);

  function edit(car: CarProfile) { setDraft({ ...car }); setMpg(String(car.mpg)); setTank(String(car.tankGallons)); setError(''); }
  function choose(car: typeof catalog.vehicles[number]) {
    edit({ id: newCarId(), name: car.name, model: car.name, mpg: car.mpg, tankGallons: estimatedTankGallons(car.vehicleClass), estimateSource: `EPA ${car.fromYear}–${car.toYear} combined MPG, lowest gasoline variant. Tank size is a vehicle-class guess.` });
  }
  function save() {
    if (!draft) return;
    try { saveCar({ ...draft, mpg: Number(mpg), tankGallons: Number(tank) }); router.back(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your car.'); }
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>DRIVING PROFILE</Text><Text style={styles.title}>Your cars</Text>
      <Text style={styles.description}>Save each car once. Choose it when planning a drive, then enter just your fuel level.</Text>
      {!draft && <>
        {cars.map((car) => <View key={car.id} style={styles.card}>
          <Text style={styles.heading}>{car.name}</Text><Text style={styles.description}>{car.model} · {car.mpg} MPG · {car.tankGallons} gal tank</Text>
          <View style={styles.row}><Pressable accessibilityRole="button" onPress={() => edit(car)} style={styles.smallButton}><Text style={styles.link}>Edit</Text></Pressable>
            {deleting === car.id ? <><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => { deleteCar(car.id); setDeleting(null); }}><Text style={styles.error}>Confirm delete</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setDeleting(null)}><Text style={styles.link}>Cancel</Text></Pressable></> : <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setDeleting(car.id)}><Text style={styles.link}>Delete</Text></Pressable>}
          </View>
        </View>)}
        <View style={styles.card}><Text style={styles.heading}>Add a car</Text>
          <TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Make and model, e.g. Subaru Crosstrek" accessibilityLabel="Search car make and model" autoCorrect={false} />
          {matches.map((car) => <Pressable key={car.name} accessibilityRole="button" style={styles.result} onPress={() => choose(car)}><Text style={styles.resultName}>{car.name}</Text><Text style={styles.meta}>~{car.mpg} MPG · add ›</Text></Pressable>)}
          <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => edit({ id: newCarId(), name: query.trim(), model: query.trim(), mpg: 22, tankGallons: 12, estimateSource: 'Generic gasoline-car guess. Set MPG and tank size for your car.' })}><Text style={styles.link}>Add a different / older car</Text></Pressable>
          <Text style={styles.meta}>Offline EPA gasoline models from {catalog.latestYear - 5}–{catalog.latestYear}. No year or trim needed. Electric-only cars aren’t included.</Text>
        </View>
      </>}
      {draft && <View style={styles.card}>
        <Text style={styles.heading}>{cars.some((car) => car.id === draft.id) ? 'Edit car' : 'Save this car'}</Text>
        <Text style={styles.label}>Name in your garage</Text><TextInput style={styles.input} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} accessibilityLabel="Car nickname" placeholder="Car A, my Subaru…" maxLength={80} />
        <Text style={styles.label}>Make / model</Text><TextInput style={styles.input} value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} accessibilityLabel="Car make and model" maxLength={100} />
        <View style={styles.row}><View style={styles.column}><Text style={styles.label}>Estimated MPG</Text><TextInput style={styles.input} value={mpg} onChangeText={setMpg} accessibilityLabel="Car estimated MPG" keyboardType="decimal-pad" /></View><View style={styles.column}><Text style={styles.label}>Tank size · US gal</Text><TextInput style={styles.input} value={tank} onChangeText={setTank} accessibilityLabel="Car tank capacity in US gallons" keyboardType="decimal-pad" /></View></View>
        <Text style={styles.meta}>{draft.estimateSource}</Text>
        <Text style={styles.description}>These are estimates. Check your tank capacity before using percent left, especially for an older model or hybrid. You can edit both values any time. Trip planning also reduces estimated range by 15% and keeps a fuel reserve.</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" style={styles.primary} onPress={save}><Text style={styles.primaryText}>Save car & use it</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => { setDraft(null); setError(''); }}><Text style={styles.link}>Cancel</Text></Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 50, gap: 16 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 36, fontWeight: '800' },
  description: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 10 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 48, paddingHorizontal: 12, color: colors.ink, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, column: { flex: 1, minWidth: 120 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginVertical: 8 },
  result: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, minHeight: 48 }, resultName: { color: colors.ink, fontWeight: '700', fontSize: 15 }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  smallButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.accentDark, fontWeight: '700' }, error: { color: colors.danger, fontSize: 13 },
  primary: { backgroundColor: colors.ink, borderRadius: 7, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.surface, fontWeight: '800' },
});
