import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import { settingsSections } from '@/features/settings/navigation';

export default function SettingsScreen() {
  useThemeRevision();
  const [query, setQuery] = useState('');
  return <SettingsPage title="Settings">
    <TextInput accessibilityLabel="Search settings" placeholder="Search settings" value={query} onChangeText={setQuery} style={{ minHeight: 48, padding: 12, color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8 }} /><View style={styles.list}>{settingsSections.filter(section => `${section.title} ${section.detail}`.toLowerCase().includes(query.toLowerCase().trim())).map(section =>
      <Link key={section.id} href={{ pathname: '/settings/[section]', params: { section: section.id } }} asChild>
        <Pressable accessibilityRole="button" style={styles.row}>
          <View style={styles.labels}><Text style={styles.label}>{section.title}</Text><Text style={styles.detail}>{section.detail}</Text></View>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>›</Text>
        </Pressable>
      </Link>
    )}</View>
  </SettingsPage>;
}
const styles = themedStyles(() => ({
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  row: { flexWrap: 'wrap', minHeight: 74, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  labels: { flex: 1, gap: 4 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  chevron: { color: colors.muted, fontSize: 26 },
}));
