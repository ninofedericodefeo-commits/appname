import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

type SavingsSection = 'goals' | 'pocket';
type MoneySection = 'pause' | 'subscriptions';

type SectionSwitcherProps =
  | { group: 'savings'; selected: SavingsSection }
  | { group: 'money'; selected: MoneySection };

const sections = {
  savings: [
    { id: 'goals', label: 'Goals', route: '/investment' },
    { id: 'pocket', label: 'Pocket', route: '/pocket' },
  ],
  money: [
    { id: 'pause', label: 'Spending pause', route: '/spending' },
    { id: 'subscriptions', label: 'Subscriptions', route: '/subscriptions' },
  ],
} as const;

export function SectionSwitcher({ group, selected }: SectionSwitcherProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {sections[group].map((section) => {
        const active = selected === section.id;
        return (
          <Pressable
            key={section.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            style={[styles.tab, active && styles.activeTab]}
            onPress={() => {
              if (!active) router.navigate(section.route);
            }}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{section.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.paleGreen,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: colors.ink,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.surface,
  },
});
