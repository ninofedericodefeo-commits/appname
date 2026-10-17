import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import { settingsSections } from '@/features/settings/navigation';
import { AppIcon } from '@/components/AppIcon';

const groups: { label: string; ids: readonly string[] }[] = [
  { label: 'Preferences', ids: ['general', 'accessibility'] },
  { label: 'Accounts & activity', ids: ['account', 'gas', 'subscriptions', 'savings'] },
  { label: 'App & data', ids: ['widgets', 'privacy', 'shortcuts', 'data', 'about'] },
];

export default function SettingsScreen() {
  useThemeRevision();
  const [query, setQuery] = useState('');
  const filtered = settingsSections.filter(section => `${section.title} ${section.detail}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <SettingsPage title="Settings">
    <View style={styles.search}><AppIcon name="search" size={20} color={colors.muted} /><TextInput accessibilityLabel="Search settings" placeholder="Search settings" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.searchInput} /></View>
    {groups.map(group => {
      const sections = filtered.filter(section => group.ids.includes(section.id));
      return sections.length ? <View key={group.label} style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupLabel}>{group.label}</Text>
        <View style={styles.list}>{sections.map((section, index) => <Link key={section.id} href={{ pathname: '/settings/[section]', params: { section: section.id } }} asChild>
          <Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.row, index === sections.length - 1 && styles.lastRow])}>
            <View style={styles.labels}><Text style={styles.label}>{section.title}</Text><Text style={styles.detail}>{section.detail}</Text></View>
            <AppIcon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        </Link>)}</View>
      </View> : null;
    })}
    {!filtered.length && <View style={styles.empty}><Text style={styles.label}>No settings found</Text><Text style={styles.detail}>Try another search.</Text></View>}
  </SettingsPage>;
}
const styles = themedStyles(() => ({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 48, paddingVertical: 12, color: colors.ink, fontSize: 17 },
  group: { gap: 8 },
  groupLabel: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '500', paddingHorizontal: 16 },
  list: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  lastRow: { borderBottomWidth: 0 },
  labels: { flex: 1, gap: 4 },
  label: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '500' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  empty: { padding: 20, gap: 8, backgroundColor: colors.surface, borderRadius: 18 },
}));
