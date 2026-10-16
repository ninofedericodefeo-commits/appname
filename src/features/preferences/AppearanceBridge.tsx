import { useThemeRevision , applyTheme } from '@/theme';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAmountVisibility } from './amountVisibility';
import { useDevicePrivacy } from '@/features/privacy/deviceStore';
export default function AppearanceBridge() {
  useThemeRevision();
  const scheme = useColorScheme(), { appearance, strongerContrast } = useSettingsStore();
  useEffect(() => { applyTheme(appearance === 'system' ? scheme === 'dark' : appearance === 'dark', strongerContrast); }, [scheme, appearance, strongerContrast]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active' && useDevicePrivacy.getState().hideAmounts) useAmountVisibility.setState({ revealed: false }); }); return () => listener.remove(); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = ':focus-visible{outline:3px solid #C15C2E!important;outline-offset:3px}input::placeholder,textarea::placeholder{color:#718477;opacity:1}';
    document.head.append(style); return () => style.remove();
  }, []);
  return null;
}
