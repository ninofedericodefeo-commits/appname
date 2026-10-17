import { Platform, Pressable, Text, View } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSystemAccessibility } from './systemPreferences';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import { dataStyles as s } from '@/features/data/styles';
function Preference({ label, detail, checked, onPress }: { label: string; detail: string; checked: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={detail} accessibilityState={{ checked }} aria-checked={checked} onPress={onPress} style={[styles.preference,checked && s.selected]}>
    <View style={{ flex: 1, minWidth: 140, gap: 5 }}><Text style={s.body}>{label}</Text><Text style={s.note}>{detail}</Text></View><Text accessible={false} importantForAccessibility="no" style={styles.state}>{checked ? 'On ✓' : 'Off'}</Text>
  </Pressable>;
}
export default function AccessibilitySettings() {
  useThemeRevision();
  const { boldText, largerControls, reduceMotion, preferStationList, strongerContrast, configure } = useSettingsStore();
  const system = useSystemAccessibility();
  return <>
    <Text style={s.note}>Changes save immediately. Text size follows your device settings or browser zoom. These options work with your screen reader and system accessibility preferences.</Text>
    <Preference label="Bolder text" detail="Makes body text and labels bolder. Your iPhone’s Bold Text setting is also respected." checked={boldText} onPress={() => configure({ boldText: !boldText })} />
    <Preference label="Larger controls" detail="Adds more room to buttons, fields and date controls. Content wraps when needed." checked={largerControls} onPress={() => configure({ largerControls: !largerControls })} />
    <Preference label="Stronger contrast" detail="Darkens secondary text and strengthens borders in either theme." checked={strongerContrast} onPress={() => configure({ strongerContrast: !strongerContrast })} />
    <Preference label="Always reduce motion" detail="Removes page and sheet transitions. When off, GasFinder follows your system Reduce Motion setting." checked={reduceMotion === 'reduce'} onPress={() => configure({ reduceMotion: reduceMotion === 'reduce' ? 'system' : 'reduce' })} />
    <Preference label="Prefer station list" detail="Starts gas results as a readable list. Native screen readers also get List first. You can still choose Map." checked={preferStationList} onPress={() => configure({ preferStationList: !preferStationList })} />
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Preview</Text><Text style={s.body}>Readable text, clear boundaries and room to tap.</Text><View style={styles.sample}><Text style={s.body}>Example control</Text></View><Text style={s.note}>A preview of your reading and control preferences.</Text></View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Using assistive tools</Text>
      {['Use headings to move between sections.', 'Transaction rows speak the direction, full amount, date and status.', 'Date controls offer previous/next day actions on the phone.', 'On the web, use arrow keys in dates and tabs, Enter to choose, and Escape to close a calendar.', 'Gas results and price charts have readable lists.'].map(tip => <Text key={tip} style={s.body}>• {tip}</Text>)}
      <Text style={s.note}>{Platform.OS === 'web' ? 'Browsers do not reliably report whether a screen reader is running. Prefer station list is available here too.' : `Screen reader: ${system.screenReader ? 'on' : 'off'}. Change VoiceOver or TalkBack and text size in your device’s Accessibility settings.`}</Text></View>
  </>;
}
const styles = themedStyles(() => ({
  preference: { minHeight: 76, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12 },
  state: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  sample: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8 },
}));
