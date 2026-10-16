import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useAmountsHidden } from '@/features/preferences/amountVisibility';
// Web alerts use their live-region semantics. Native forms announce a new error once.
export function useValidationAnnouncement(message: string) {
  const hidden = useAmountsHidden();
  useEffect(() => { if (message && !hidden && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message); }, [message,hidden]);
}
