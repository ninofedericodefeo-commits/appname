import { Tabs } from 'expo-router';

import { BottomNavigation, type Tab } from '@/components/BottomNavigation';

export default function MainTabsLayout() {
  return <Tabs
    screenOptions={{ headerShown: false }}
    tabBar={({ state, navigation }) => (
      <BottomNavigation
        activeTab={tabForRoute(state.routes[state.index].name)}
        onSelect={(tab) => navigation.navigate(tab)}
      />
    )}
  >
    <Tabs.Screen name="index" options={{ title: 'Gas' }} />
    <Tabs.Screen name="investment" options={{ title: 'Savings' }} />
    <Tabs.Screen name="pocket" options={{ href: null }} />
    <Tabs.Screen name="spending" options={{ href: null }} />
    <Tabs.Screen name="subscriptions" options={{ title: 'Money' }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
  </Tabs>;
}

function tabForRoute(routeName: string): Tab {
  if (routeName === 'pocket') return 'investment';
  if (routeName === 'spending') return 'subscriptions';
  if (routeName === 'index' || routeName === 'investment' || routeName === 'subscriptions' || routeName === 'activity') {
    return routeName;
  }
  throw new Error(`Unsupported tab route: ${routeName}`);
}
