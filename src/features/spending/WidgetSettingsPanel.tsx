import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Pressable, Text, View } from 'react-native';
import { useWidgetSettingsStore } from '@/stores/widgetSettingsStore';
import { accountWidgetsAvailable } from './widgets';

export default function WidgetSettingsPanel() {
  useThemeRevision();
  const { enabled, showAmounts, setEnabled, setShowAmounts } = useWidgetSettingsStore();
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Account widget</Text>
    <Text style={styles.note}>Add Tally account from your iPhone’s widget gallery. It shows the same dated balance estimate and set-aside amount as Account. This is not a live bank feed.</Text>
    {accountWidgetsAvailable ? <>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} style={styles.choice} onPress={() => setEnabled(!enabled)}><Text style={styles.label}>{enabled ? 'Account widget enabled ✓' : 'Enable account widget'}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: showAmounts }} style={styles.choice} onPress={() => setShowAmounts(!showAmounts)}><Text style={styles.label}>{showAmounts ? 'Amounts visible on widget ✓' : 'Amounts hidden on widget'}</Text></Pressable>
    </> : <Text style={styles.note}>Requires an updated iPhone build with widgets enabled. The current free Apple Personal Team build cannot use the App Groups capability these widgets need.</Text>}
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 10, gap: 12 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  choice: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, justifyContent: 'center' }, label: { color: colors.ink, fontWeight: '700' },
}));
