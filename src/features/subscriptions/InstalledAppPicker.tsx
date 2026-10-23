import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { APPLE_SUBSCRIPTIONS, subscriptionApp } from './providerApps';
import type { SubscriptionApp } from './providerApps';
import type { InstalledAppResult } from './installedAppLogic';
import { installedSubscriptionApps } from './installedApps';
import SubscriptionButton from './SubscriptionButton';

export default function InstalledAppPicker({ selected, onSelect }: { selected?: SubscriptionApp; onSelect: (app?: SubscriptionApp) => void }) {
  useThemeRevision();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<InstalledAppResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualError, setManualError] = useState('');
  const generation = useRef(0);
  async function refresh() {
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = await installedSubscriptionApps();
      if (current === generation.current) setResult(next);
    } catch { if (current === generation.current) setResult({ status: 'error', apps: [] }); }
    finally { if (current === generation.current) setLoading(false); }
  }
  function cancelRefresh() { generation.current++; }
  useEffect(() => {
    if (!expanded) return;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { cancelRefresh(); listener.remove(); };
  }, [expanded]);
  const apps = useMemo(() => result?.apps.filter(app => app.name.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [result, search]);
  function chooseManual() {
    try { choose(subscriptionApp({ name: manualName, url: manualUrl })); setManual(false); setManualError(''); }
    catch (error) { setManualError(error instanceof Error ? error.message : 'Check the app name and link.'); }
  }
  function choose(app?: SubscriptionApp) { onSelect(app); setExpanded(false); setSearch(''); }
  return <View style={styles.container}>
    <Text style={styles.label}>App to open when you plan to cancel</Text>
    <View style={styles.row}><Text style={styles.selected}>{selected?.name ?? 'No app selected'}</Text>
      <SubscriptionButton label={selected ? 'Change app' : 'Choose app'} accessibilityState={{ expanded }} onPress={() => { if (!expanded) void refresh(); setExpanded(!expanded); }} />
    </View>
    {selected && !expanded && <Text style={styles.note}>You complete cancellation in the app or with the provider.</Text>}
    {expanded && <View style={styles.list}>
      <Pressable accessibilityRole="button" accessibilityLabel="Select no associated app" style={styles.option} onPress={() => choose()}><Text style={styles.optionText}>No associated app</Text></Pressable>
      {loading ? <Text accessibilityLiveRegion="polite" style={styles.note}>Checking apps on your phone…</Text> : <>
        {result?.status === 'web' && <Text style={styles.note}>Choose installed apps in Tally on your phone. A browser cannot check which phone apps are installed.</Text>}
        {result?.status === 'update-required' && <Text style={styles.note}>Install the updated Tally build to choose apps on this phone. Reloading the app cannot add the app picker.</Text>}
        {result?.status === 'error' && <Text style={styles.note}>Some apps could not be checked. Try refreshing the list.</Text>}
        {!!result && (result.status === 'ready' || result.status === 'error') && <>
          <Text style={styles.note}>{Platform.OS === 'ios' ? 'Supported apps installed on this iPhone. Apple limits which apps we can check; your full app list is private.' : 'Apps with a launcher on this Android device. Hidden, work-profile and non-launchable apps may not appear.'} Installing an app does not tell us whether you pay for it.</Text>
          {!!result.apps.length && <TextInput style={styles.search} accessibilityLabel="Search installed apps" placeholder="Search apps" value={search} onChangeText={setSearch} autoCorrect={false} />}
          {apps.map(app => <Pressable key={app.url} accessibilityRole="button" accessibilityLabel={`Select ${app.name}`} accessibilityState={{ selected: selected?.url === app.url }} style={styles.option} onPress={() => choose(app)}><Text style={styles.optionText}>{app.name}</Text><Text style={styles.check}>{selected?.url === app.url ? '✓' : '›'}</Text></Pressable>)}
          {!apps.length && <Text style={styles.note}>{result.apps.length ? 'No matching apps.' : 'No apps found. Add an app or website below, or save without an app.'}</Text>}
        </>}
        {Platform.OS === 'ios' && <><Text style={styles.label}>Billed through Apple?</Text><Pressable accessibilityRole="button" style={styles.option} onPress={() => choose(APPLE_SUBSCRIPTIONS)}><Text style={styles.optionText}>Apple subscriptions</Text><Text style={styles.check}>›</Text></Pressable></>}
        <SubscriptionButton label={manual ? 'Hide manual app entry' : 'Add another app or website'} accessibilityState={{ expanded: manual }} onPress={() => setManual(!manual)} />
        {manual && <View style={styles.list}>
          <Text style={styles.note}>For an app that is missing, enter its name and HTTPS account website or a known app link. This does not check whether it is installed.</Text>
          <Text style={styles.label}>App name</Text><TextInput style={styles.search} accessibilityLabel="Associated app name" value={manualName} onChangeText={setManualName} maxLength={80} placeholder="App or provider name" />
          <Text style={styles.label}>Account website or app link</Text><TextInput style={styles.search} accessibilityLabel="Associated app website or link" value={manualUrl} onChangeText={setManualUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} placeholder="https://provider.example/account" />
          {!!manualError && <Text accessibilityLiveRegion="polite" style={styles.error}>{manualError}</Text>}
          <SubscriptionButton label="Use this app or website" onPress={chooseManual} />
        </View>}
        {result?.status !== 'web' && <SubscriptionButton label="Refresh apps" onPress={() => void refresh()} />}
      </>}
    </View>}
  </View>;
}
const styles = themedStyles(() => ({
  container: { gap: 10 }, label: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  row: { flexWrap: 'wrap', flexDirection: 'row', gap: 10, alignItems: 'center' }, selected: { color: colors.ink, flex: 1, fontSize: 15 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, list: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10 },
  optionText: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1 }, check: { color: colors.primary, fontSize: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  search: { minHeight: 46, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, paddingHorizontal: 12, color: colors.ink },
}));
