import { Tabs } from 'expo-router';

import { BottomNavigation, type Tab } from '@/components/BottomNavigation';

export default function MainTabsLayout() {
  return <Tabs
    screenOptions={{ headerShown: false }}
    tabBar={({ state, navigation }) => (
      <BottomNavigation
        activeTab={state.routes[state.index].name as Tab}
        onSelect={(tab) => navigation.navigate(tab)}
      />
    )}
  >
    <Tabs.Screen name="index" options={{ title: 'Gas' }} />
    <Tabs.Screen name="investment" options={{ title: 'Goals' }} />
    <Tabs.Screen name="pocket" options={{ title: 'Pocket' }} />
    <Tabs.Screen name="spending" options={{ title: 'Pause' }} />
    <Tabs.Screen name="subscriptions" options={{ title: 'Renewals' }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
  </Tabs>;
}
