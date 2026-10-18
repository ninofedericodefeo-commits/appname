import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { router, usePathname , Tabs } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';

import { BottomNavigation, type Tab } from '@/components/BottomNavigation';

export default function MainTabsLayout() {
  const pathname = usePathname(), started = useRef(false);
  useEffect(() => {
    let canceled = false;
    async function open() {
      if (started.current) return;
      started.current = true;
      const incoming = await Linking.getInitialURL();
      const start = useSettingsStore.getState().startScreen;
      if (!canceled && pathname === '/' && start !== 'index' && (!incoming || /^https?:\/\/[^/]+\/?$/.test(incoming))) router.replace(`/${start}`);
    }
    if (useSettingsStore.persist.hasHydrated()) void open();
    const stop = useSettingsStore.persist.onFinishHydration(() => { void open(); });
    return () => { canceled = true; stop(); };
  }, [pathname]);
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
    <Tabs.Screen name="pocket" options={{ title: 'Account' }} />
    <Tabs.Screen name="subscriptions" options={{ title: 'Bills' }} />
  </Tabs>;
}
