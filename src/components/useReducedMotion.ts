import { useSettingsStore } from '@/stores/settingsStore';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => { let active = true; void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => { /* Keep motion reduced when the system preference is unavailable. */ }); const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced); return () => { active = false; subscription.remove(); }; }, []);
  const preference = useSettingsStore(state => state.reduceMotion);
  return preference === 'reduce' || reduced;
}
