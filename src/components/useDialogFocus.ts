import { useRef } from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';
export function useDialogFocus() {
  const heading = useRef<Text>(null);
  const focus = () => { requestAnimationFrame(() => { if (!heading.current) return; if (Platform.OS === 'web') heading.current.focus(); else AccessibilityInfo.sendAccessibilityEvent(heading.current,'focus'); }); };
  return { heading, focus };
}
