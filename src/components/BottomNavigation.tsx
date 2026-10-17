import TabKeyboardGroup from './TabKeyboardGroup';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from './AppIcon';

export type Tab = 'index' | 'investment' | 'pocket' | 'subscriptions';

const tabs: readonly { id: Tab; label: string; icon: AppIconName }[] = [
  { id: 'index', label: 'Gas', icon: 'fuel' },
  { id: 'investment', label: 'Goals', icon: 'target' },
  { id: 'pocket', label: 'Account', icon: 'wallet' },
  { id: 'subscriptions', label: 'Subs', icon: 'repeat' },
];

export function BottomNavigation({ activeTab, onSelect }: { activeTab: Tab; onSelect: (tab: Tab) => void }) {
  useThemeRevision();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  return <SafeAreaView edges={['bottom']} style={styles.safeArea}>
    <TabKeyboardGroup onSelect={index => onSelect(tabs[index].id)}><View style={styles.row} accessibilityRole="tablist" accessibilityLabel="Main navigation">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active} accessibilityLabel={tab.id === 'subscriptions' ? 'Subscriptions' : tab.label} tabIndex={active ? 0 : -1} style={({ pressed }) => StyleSheet.flatten([styles.tab, active && styles.activeTab, pressed && styles.pressed])} onPress={() => { if (!active) onSelect(tab.id); }}>
          <View style={[styles.selectionMark, active && styles.activeMark]} />
          <AppIcon name={tab.icon} size={23} color={active ? colors.primary : colors.muted} />
          <Text maxFontSizeMultiplier={1.5} style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View></TabKeyboardGroup>
  </SafeAreaView>;
}

const styles = themedStyles(() => ({
  safeArea: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: { width: '100%', maxWidth: 760, alignSelf: 'center', marginHorizontal: 'auto', flexDirection: 'row', paddingTop: 5, paddingBottom: 4, paddingHorizontal: 12, gap: 4 },
  tab: { flex: 1, minWidth: 60, paddingHorizontal: 4, paddingTop: 7, paddingBottom: 5, minHeight: 58, gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  activeTab: { backgroundColor: colors.tint },
  pressed: { opacity: 0.65 },
  selectionMark: { position: 'absolute', top: 0, width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  activeMark: { backgroundColor: colors.primary },
  label: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '500', textAlign: 'center', flexShrink: 1 },
  activeLabel: { color: colors.primary, fontWeight: '700' },
}));
