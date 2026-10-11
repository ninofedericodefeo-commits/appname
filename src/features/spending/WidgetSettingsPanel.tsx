import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { accountWidgetsAvailable, endPauseActivities } from './widgets';
import { colors } from '@/theme';

export default function WidgetSettingsPanel() {
  const { enabled, showAmounts, setEnabled, setShowAmounts } = useWidgetSettingsStore();
  const [message, setMessage] = useState('');
  async function stop() {
    try { await endPauseActivities(); setMessage('Live Activity stopped. Your waiting list stays saved.'); }
    catch { setMessage('Could not stop the activity. Open GasFinder again or dismiss it on your Lock Screen.'); }
  }
  return <View style={styles.card}>
    <Text style={styles.heading}>Widgets & Live Activity</Text>
    <Text style={styles.note}>Add GasFinder account from your iPhone’s widget gallery. It shows your saved available balance and waiting-list count. This is not a live bank feed.</Text>
    {accountWidgetsAvailable ? <>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} style={styles.choice} onPress={() => setEnabled(!enabled)}><Text style={styles.label}>{enabled ? 'Account widget enabled ✓' : 'Enable account widget'}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: showAmounts }} style={styles.choice} onPress={() => setShowAmounts(!showAmounts)}><Text style={styles.label}>{showAmounts ? 'Amounts visible on widget ✓' : 'Amounts hidden on widget'}</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.choice} onPress={() => void stop()}><Text style={styles.label}>Stop purchase Live Activity</Text></Pressable>
    </> : <Text style={styles.note}>Requires an updated iPhone build with widgets enabled. The current free Apple Personal Team build cannot use the App Groups capability these widgets need.</Text>}
    <Text style={styles.note}>In Subs, use Track on Lock Screen on a waiting-list purchase. Its Live Activity shows time until review for up to 8 hours, with no purchase name or price. This tracks your waiting list; checkout pauses are controlled separately in the browser extension.</Text>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  choice: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, justifyContent: 'center' }, label: { color: colors.ink, fontWeight: '700' },
});
