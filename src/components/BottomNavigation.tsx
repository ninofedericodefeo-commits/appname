import { Link, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

type Tab = 'gas' | 'goals' | 'more';

const tabs = [
  { id: 'gas', label: 'Gas', href: '/' },
  { id: 'goals', label: 'Goals', href: '/investment' },
  { id: 'more', label: 'More', href: '/menu' },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  const activeTab: Tab = pathname === '/' || pathname === '/price-history' || pathname === '/report-receipt'
    ? 'gas'
    : pathname === '/investment'
        ? 'goals'
        : 'more';

  return <SafeAreaView edges={['bottom']} style={styles.safeArea}>
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return <Link key={tab.id} href={tab.href} replace asChild>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} style={StyleSheet.flatten([styles.tab, active && styles.activeTab])}>
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        </Link>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 10, gap: 4 },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  activeTab: { backgroundColor: colors.paleGreen },
  label: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  activeLabel: { color: colors.ink, fontWeight: '800' },
});
