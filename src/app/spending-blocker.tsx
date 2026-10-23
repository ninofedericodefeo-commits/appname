import { themedStyles, useThemeRevision , colors } from '@/theme';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { openSafariBlockerSettings, safariBlockerStatus } from '@/features/spending/safariBlocker';
import type { SafariBlockerStatus } from '@/features/spending/safariBlocker';

export default function SpendingBlockerScreen() {
  useThemeRevision();
  const [status, setStatus] = useState<SafariBlockerStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setStatus(await safariBlockerStatus()); }
    catch { setError('Could not check the Safari extension. Open Safari’s Extensions settings to check it.'); }
  }, []);
  useEffect(() => {
    let mounted = true;
    void safariBlockerStatus().then(value => { if (mounted) setStatus(value); }, () => {
      if (mounted) setError('Could not check the Safari extension. Open Safari’s Extensions settings to check it.');
    });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { mounted = false; listener.remove(); };
  }, [refresh]);
  async function openSettings() {
    if (busy) return;
    setBusy(true); setError('');
    try { await openSafariBlockerSettings(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Open Settings → Apps → Safari → Extensions → Tally Spending Pause.'); }
    finally { setBusy(false); }
  }
  const downloadUrl = Platform.OS === 'web' ? `${window.location.origin}/downloads/GasFinder-Chrome.zip` : typeof Constants.expoConfig?.extra?.privateDownloadBaseUrl === 'string' ? `${Constants.expoConfig.extra.privateDownloadBaseUrl}/downloads/GasFinder-Chrome.zip` : null;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><FormScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Pause online shopping</Text>
    <Text style={styles.body}>Keep browsing your favorite shops while recognized checkout and payment pages take a cooling-off break.</Text>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Safari extension</Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{Platform.OS !== 'ios' ? 'Available on iPhone' : !status ? 'Checking this build…' : !status.bundled ? 'An updated iPhone build is needed' : status.enabled === true ? 'Extension enabled in Safari' : status.enabled === false ? 'Enable the extension in Safari' : 'Check the extension in Safari settings'}</Text>
      {Platform.OS === 'ios' && status?.bundled && status.settingsSupported && <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void openSettings()}><Text style={styles.buttonText}>{busy ? 'Opening…' : 'Open Safari extension settings'}</Text></Pressable>}
      {status?.bundled && <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void refresh()}><Text style={styles.link}>Check extension status</Text></Pressable>}
      {!status?.bundled && <Text style={styles.note}>{Platform.OS === 'ios' ? 'The extension comes with the new Tally app build. A Metro reload or Expo Go cannot add it.' : 'Use the Tally iPhone build for Safari, or set up the extension in desktop Chrome.'}</Text>}
      <Text style={styles.note}>Active pause status is held by the browser extension and cannot be read here. Installed/enabled status alone is not a pause.</Text>
      <Text style={styles.note}>Choose shops and start the checkout pause from Safari’s Spending Pause controls. Enabling the extension alone does not start blocking.</Text>
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Set it up once</Text>
      <Text style={styles.body}>1. Open iPhone Settings → Apps → Safari → Extensions → Tally Spending Pause and turn it on.</Text>
      <Text style={styles.body}>2. In Safari, open the page menu beside the address bar, then Extensions → Tally Spending Pause.</Text>
      <Text style={styles.body}>3. Choose your shopping websites and a wait of 24 hours, 2 days or 7 days. Tap Pause checkout.</Text>
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>A pause that stays in place</Text>
      <Text style={styles.body}>Product pages and carts stay available. The extension blocks checkout/payment paths and checkout subdomains at selected shops, with extra rules for Amazon and eBay checkout.</Text>
      <Text style={styles.body}>Closing Tally or the browser keeps the pause. After the wait, open the extension and choose Resume shopping when you’re ready.</Text>
      <Text style={styles.note}>Payment inside other pages, external payment services, other browsers and shopping apps may bypass the pause. This is a checkout interruption, not a card freeze. You can disable the extension in browser settings.</Text>
      <Text style={styles.note}>If the wrong page is blocked, the extension offers a visible 10-minute override for one selected shop. That temporarily allows checkout; blocking resumes with an extension alarm. Browser suspension or disabling the extension can interrupt enforcement.</Text>
      <Text style={styles.note}>Website choices stay in Safari on this device. The extension does not read page contents, bank data or your browsing history.</Text>
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Chrome on a computer · v1.1.0</Text>
      {downloadUrl ? <><Pressable accessibilityRole="button" style={styles.button} onPress={() => void Linking.openURL(downloadUrl).catch(() => setError('Could not open download.'))}><Text style={styles.buttonText}>Download Chrome extension ZIP</Text></Pressable><Pressable accessibilityRole="button" style={styles.textButton} onPress={() => void Clipboard.setStringAsync(downloadUrl).then(() => setError('Download link copied. Send it to your own computer.'), () => setError('Could not copy download link.'))}><Text style={styles.link}>Copy download link for computer</Text></Pressable></> : <Text style={styles.note}>Open this app’s browser preview on your computer to download the ZIP. A private download address can be configured in your build; this app does not upload financial data.</Text>}
      <Text style={styles.note}>Unzip, then Load unpacked. To update, replace the same folder and click Reload on chrome://extensions. Keep the same installation to retain its browser preferences.</Text>
      <Text style={styles.body}>The desktop Chrome companion uses the same shops, wait and checkout rules. In Chrome’s Manage extensions page, turn on Developer mode, choose Load unpacked and select the supplied Tally extension folder. Open Spending Pause from the extensions menu.</Text>
      <Text style={styles.note}>Chrome on iPhone cannot run browser extensions. Safari is the supported iPhone option. Each browser keeps its own pause; these settings do not sync between devices.</Text>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </FormScrollView></SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 40, gap: 16 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 32, letterSpacing: -.8 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 17, borderWidth: 1, borderColor: colors.line, gap: 12 },
  heading: { color: colors.ink, fontSize: 19, fontWeight: '800' }, status: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 22 }, note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  button: { backgroundColor: colors.ink, minHeight: 48, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.surface, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontSize: 13, fontWeight: '700' }, disabled: { opacity: .5 }, error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
}));
