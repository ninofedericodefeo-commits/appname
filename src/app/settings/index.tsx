import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import { settingsSections } from '@/features/settings/navigation';
import { colors } from '@/theme';

export default function SettingsScreen() {
  return <SettingsPage title="Settings">
    <View style={styles.list}>{settingsSections.map(section =>
      <Link key={section.id} href={{ pathname: '/settings/[section]', params: { section: section.id } }} asChild>
        <Pressable accessibilityRole="button" style={styles.row}>
          <View style={styles.labels}><Text style={styles.label}>{section.title}</Text><Text style={styles.detail}>{section.detail}</Text></View>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>›</Text>
        </Pressable>
      </Link>
    )}</View>
  </SettingsPage>;
}
const styles = StyleSheet.create({
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  labels: { flex: 1, gap: 4 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  chevron: { color: colors.muted, fontSize: 26 },
});
