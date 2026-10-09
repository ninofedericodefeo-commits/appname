import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

type Section = { id: string; label: string; component: ComponentType };

export function CombinedSections({ sections }: { sections: readonly Section[] }) {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedId = sections.find((item) => item.id === section)?.id;
  const initialId = requestedId ?? sections[0].id;
  const [selection, setSelection] = useState({ activeId: initialId, visited: [initialId] });
  const activeId = requestedId ?? (section === undefined ? selection.activeId : sections[0].id);

  // Explicit links select a section; returning through the bottom bar keeps the last selection.
  if (activeId !== selection.activeId) {
    setSelection({ activeId, visited: selection.visited.includes(activeId) ? selection.visited : [...selection.visited, activeId] });
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
    <View accessibilityRole="tablist" style={styles.switcher}>
      {sections.map((item) => {
        const active = item.id === activeId;
        return <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          aria-selected={active}
          style={[styles.tab, active && styles.activeTab]}
          onPress={() => {
            if (active) return;
            Keyboard.dismiss();
            router.setParams({ section: item.id });
          }}
        >
          <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
    {sections.map(({ id, component: Panel }) => {
      const active = id === activeId;
      return <View
        key={id}
        style={[styles.panel, !active && styles.hidden]}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!active}
      >
        {/* Keep visited panels mounted so switching preserves drafts and scroll position. */}
        {(active || selection.visited.includes(id)) && <Panel />}
      </View>;
    })}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  switcher: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, padding: 4, gap: 4, backgroundColor: colors.paleGreen, borderRadius: 9 },
  tab: { flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: colors.ink },
  label: { color: colors.inkSoft, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  activeLabel: { color: colors.surface },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
