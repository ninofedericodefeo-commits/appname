import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Redirect, usePathname, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { initialStartPath } from '@/features/preferences/startScreen';
import { colors, useThemeRevision } from '@/theme';

import { BottomNavigation, type Tab } from '@/components/BottomNavigation';

export default function MainTabsLayout() {
  useThemeRevision();
  const pathname = usePathname(), initialPath = useRef(pathname);
  const [startup, setStartup] = useState<{ from: string; target: ReturnType<typeof initialStartPath> } | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let canceled = false, started = false;
    async function open() {
      if (started) return;
      started = true;
      const incoming = await Linking.getInitialURL().catch(() => null);
      const start = useSettingsStore.getState().startScreen;
      if (!canceled) setStartup({ from: initialPath.current, target: initialStartPath(initialPath.current, start, incoming) });
    }
    if (useSettingsStore.persist.hasHydrated()) void open();
    const stop = useSettingsStore.persist.onFinishHydration(() => { void open(); });
    return () => { canceled = true; stop(); };
  }, []);
  useEffect(() => {
    let current = true;
    if (startup && !settled && (!startup.target || pathname !== startup.from)) {
      void Promise.resolve().then(() => { if (current) setSettled(true); });
    }
    return () => { current = false; };
  }, [pathname, startup, settled]);
  // Resolve plain launches before mounting the Gas screen. Existing Gas links
  // still own '/', and subsequent tab changes never rerun the launch redirect.
  if (!startup) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}><ActivityIndicator color={colors.primary} accessibilityLabel="Opening Centsward" /></View>;
  if (!settled && startup.target && pathname === startup.from) return <Redirect href={startup.target} />;
  return <Tabs
    initialRouteName="pocket"
    screenOptions={{ headerShown: false }}
    tabBar={({ state, navigation }) => (
      <BottomNavigation
        activeTab={state.routes[state.index].name as Tab}
        onSelect={(tab) => navigation.navigate(tab)}
      />
    )}
  >
    <Tabs.Screen name="pocket" options={{ title: 'Account' }} />
    <Tabs.Screen name="investment" options={{ title: 'Goals' }} />
    <Tabs.Screen name="subscriptions" options={{ title: 'Bills' }} />
    <Tabs.Screen name="index" options={{ title: 'Gas' }} />
  </Tabs>;
}
