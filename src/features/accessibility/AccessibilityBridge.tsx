import { useEffect } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { applyAccessibility } from '@/theme';
import { useSystemAccessibility } from './systemPreferences';
export default function AccessibilityBridge() {
  const { boldText, largerControls } = useSettingsStore();
  const systemBold = useSystemAccessibility(state => state.boldText);
  useEffect(() => { applyAccessibility(boldText || systemBold,largerControls); }, [boldText,systemBold,largerControls]);
  useEffect(() => {
    let active = true, revision = 0;
    const read = async () => {
      const request = ++revision;
      const [reader,bold] = await Promise.allSettled([AccessibilityInfo.isScreenReaderEnabled(),Platform.OS === 'ios' ? AccessibilityInfo.isBoldTextEnabled() : Promise.resolve(false)]);
      if (!active || request !== revision) return;
      useSystemAccessibility.setState({ ...(reader.status === 'fulfilled' ? { screenReader: reader.value } : {}), ...(bold.status === 'fulfilled' ? { boldText: bold.value } : {}) });
    };
    void read();
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', screenReader => { revision++; useSystemAccessibility.setState({ screenReader }); });
    const bold = Platform.OS === 'ios' ? AccessibilityInfo.addEventListener('boldTextChanged', boldText => { revision++; useSystemAccessibility.setState({ boldText }); }) : null;
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
    return () => { active = false; reader.remove(); bold?.remove(); foreground.remove(); };
  }, []);
  return null;
}
