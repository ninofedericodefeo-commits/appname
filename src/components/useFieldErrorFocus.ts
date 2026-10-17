import { useEffect, useState, type RefObject } from 'react';
import type { TextInput } from 'react-native';
import { AccessibilityInfo, Platform } from 'react-native';

// Focus after the inline errors have committed, so their descriptions are available.
export function useFieldErrorFocus() {
  const [request,setRequest] = useState<{ ref: RefObject<TextInput | null> } | null>(null);
  useEffect(() => {
    const field = request?.ref.current;
    if (!field) return;
    field.focus();
    if (Platform.OS !== 'web') AccessibilityInfo.sendAccessibilityEvent(field,'focus');
  }, [request]);
  return (ref: RefObject<TextInput | null>) => setRequest({ ref });
}
