import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export type Tab = 'index' | 'investment' | 'subscriptions' | 'activity';

const tabs = [
  { id: 'index', label: 'Gas' },
  { id: 'investment', label: 'Savings' },
  { id: 'subscriptions', label: 'Money' },
  { id: 'activity', label: 'Activity' },
] as const;

export function BottomNavigation({ activeTab, onSelect }: { activeTab: Tab; onSelect: (tab: Tab) => void }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  return <SafeAreaView edges={['bottom']} style={styles.safeArea}>
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active} style={StyleSheet.flatten([styles.tab, active && styles.activeTab])} onPress={() => { if (!active) onSelect(tab.id); }}>
          <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 3, gap: 1 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  activeTab: { backgroundColor: colors.paleGreen },
  label: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  activeLabel: { color: colors.ink, fontWeight: '800' },
});
