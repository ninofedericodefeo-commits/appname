import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useDevicePrivacy, usePrivacySession } from './deviceStore';
import { authenticateDevice } from './authenticate';
import { dataStyles as s } from '@/features/data/styles';
import { colors } from '@/theme';
export function PrivacyGate({ children }: { children: ReactNode }) {
  const { enabled, hidePreview, relockSeconds } = useDevicePrivacy();
  const { unlocked } = usePrivacySession();
  const hydrated = useSyncExternalStore(useDevicePrivacy.persist.onFinishHydration, useDevicePrivacy.persist.hasHydrated, () => false);
  const [inactive, setInactive] = useState(AppState.currentState !== 'active'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const protectionEnabled = useRef(false);
  const authenticating = useRef(false), leftAt = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const listener = AppState.addEventListener('change', state => {
      setInactive(state !== 'active');
      if (authenticating.current) return;
      if (state !== 'active') { leftAt.current ??= Date.now(); if (enabled && relockSeconds === 0) usePrivacySession.setState({ unlocked: false }); }
      else { if (enabled && leftAt.current !== null && Date.now() - leftAt.current >= relockSeconds * 1000) usePrivacySession.setState({ unlocked: false }); leftAt.current = null; }
    });
    return () => listener.remove();
  }, [enabled, relockSeconds]);
  useEffect(() => {
    if (Platform.OS === 'web' || !hydrated || !hidePreview && !protectionEnabled.current) return;
    let active = true;
    const sync = async () => {
      try {
        const ScreenCapture = await import('expo-screen-capture');
        if (Platform.OS === 'ios') { if (hidePreview) await ScreenCapture.enableAppSwitcherProtectionAsync(1); else await ScreenCapture.disableAppSwitcherProtectionAsync(); }
        else { if (hidePreview) await ScreenCapture.preventScreenCaptureAsync('privacy'); else await ScreenCapture.allowScreenCaptureAsync('privacy'); }
        protectionEnabled.current = hidePreview;
        if (active) usePrivacySession.setState({ warning: '' });
      } catch { if (active) usePrivacySession.setState({ warning: 'Preview protection could not be enabled. Update the native build and retry this setting.' }); }
    };
    void sync(); return () => { active = false; };
  }, [hidePreview, hydrated]);
  const locked = Platform.OS !== 'web' && hydrated && enabled && !unlocked;
  async function unlock() {
    setBusy(true); setError(''); authenticating.current = true;
    try { await authenticateDevice(); leftAt.current = null; } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not unlock.'); }
    finally { authenticating.current = false; setBusy(false); }
  }
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  return <>{children}<Modal visible={locked || (Platform.OS !== 'web' && inactive && (hidePreview || enabled))} animationType="none" onRequestClose={() => {}}><View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 18, backgroundColor: colors.paper }}><Text style={s.title}>GasFinder</Text><Text style={s.note}>{locked ? 'Unlock to view your account and saved records.' : 'Your records are hidden while the app is in the background.'}</Text>{locked && !inactive && <Pressable accessibilityRole="button" style={s.button} disabled={busy} onPress={() => void unlock()}><Text style={s.buttonText}>{busy ? 'Unlocking…' : 'Unlock with device authentication'}</Text></Pressable>}{!!error && <Text style={s.danger}>{error}</Text>}</View></Modal></>;
}
