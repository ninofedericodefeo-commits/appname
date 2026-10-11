import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { preferredMapsApp } from '@/features/stations/preferences';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors } from '@/theme';

export default function SettingsScreen() {
  const { mapsPreference, refillPercent, selectedFuelType, setMapsPreference, setRefillPercent, setSelectedFuelType } = useSettingsStore();
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const maps = preferredMapsApp(mapsPreference, Platform.OS);
  function saveRefill(value: number) {
    try { setRefillPercent(value); setMessage(`Saved. Plan refills at ${value}% left.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the refill level.'); }
  }
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}><FormScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>PREFERENCES</Text><Text style={styles.title}>Settings</Text>
    <View style={styles.card}><Text style={styles.heading}>Bank statements</Text>
      <Link href="/statement-automation" asChild><Pressable accessibilityRole="button" style={styles.choice}><Text style={styles.choiceText}>Set up quick statement import ›</Text></Pressable></Link>
      <Text style={styles.note}>Add the shortcut and see how to share a PDF from Citizens.</Text>
    </View>
    <View style={styles.card}><Text style={styles.heading}>Which Maps do you use?</Text>
      <View style={styles.row}>{(['apple', 'google'] as const).map((app) => <Pressable key={app} accessibilityRole="button" accessibilityState={{ selected: maps === app, disabled: app === 'apple' && Platform.OS !== 'ios' }} disabled={app === 'apple' && Platform.OS !== 'ios'} onPress={() => setMapsPreference(app)} style={[styles.choice, maps === app && styles.selected, app === 'apple' && Platform.OS !== 'ios' && styles.disabled]}><Text style={[styles.choiceText, maps === app && styles.selectedText]}>{app === 'apple' ? 'Apple Maps' : 'Google Maps'}</Text></Pressable>)}</View>
      <Text style={styles.note}>Station directions and planned trips open in your preferred Maps app. Apple Maps is available on iPhone.</Text>
    </View>
    <View style={styles.card}><Text style={styles.heading}>Refill when the tank reaches…</Text><Text style={styles.value}>{refillPercent}% left</Text>
      <View style={styles.row}>{[5, 10, 15, 20, 25].map((percent) => <Pressable key={percent} accessibilityRole="button" accessibilityState={{ selected: refillPercent === percent }} style={[styles.choice, refillPercent === percent && styles.selected]} onPress={() => saveRefill(percent)}><Text style={[styles.choiceText, refillPercent === percent && styles.selectedText]}>{percent}%</Text></Pressable>)}</View>
      <Text style={styles.note}>10% means 10% of a full tank. We suggest a stop before you reach that level, using your saved car estimates. If you’re already below it, we look for a nearby reachable stop.</Text>
      <TextInput value={custom} onChangeText={setCustom} keyboardType="decimal-pad" placeholder="Custom level · 5–50%" accessibilityLabel="Custom refill percentage" style={styles.input} />
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => saveRefill(Number(custom))}><Text style={styles.buttonText}>Save refill level</Text></Pressable>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
    </View>
    <View style={styles.card}><Text style={styles.heading}>Fuel price preference</Text><View style={styles.row}>{(['regular', 'midgrade', 'premium', 'diesel'] as const).map((fuel) => <Pressable key={fuel} accessibilityRole="button" accessibilityState={{ selected: selectedFuelType === fuel }} onPress={() => setSelectedFuelType(fuel)} style={[styles.choice, selectedFuelType === fuel && styles.selected]}><Text style={[styles.choiceText, selectedFuelType === fuel && styles.selectedText]}>{fuel.charAt(0).toUpperCase() + fuel.slice(1)}</Text></Pressable>)}</View></View>
    <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Manage saved cars</Text></Pressable></Link>
    <Link href="/investment" asChild><Pressable accessibilityRole="button" style={styles.choice}><Text style={styles.choiceText}>Savings goals & settings ›</Text></Pressable></Link>
    <Text style={styles.note}>Your preferences are saved on this device.</Text>
  </FormScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 50, gap: 16 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 36, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, value: { color: colors.accentDark, fontSize: 30, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center' }, choiceText: { color: colors.ink, fontWeight: '700' }, selected: { backgroundColor: colors.ink }, selectedText: { color: colors.surface }, disabled: { opacity: .4 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, paddingHorizontal: 12, color: colors.ink }, button: { minHeight: 48, backgroundColor: colors.ink, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.surface, fontWeight: '800' },
});
