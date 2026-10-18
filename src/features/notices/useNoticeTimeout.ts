import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { scheduleNoticeDismissal } from './noticeTimer';

export function useNoticeTimeout(key: string | number, dismiss: () => void, duration = 3000, enabled = true) {
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);
  useEffect(() => {
    if (!key || !enabled) return;
    const recommendation = AccessibilityInfo.isScreenReaderEnabled().then(async screenReader => {
      const minimum = screenReader ? Math.max(10000, duration) : duration;
      if (Platform.OS !== 'android') return minimum;
      try { return await AccessibilityInfo.getRecommendedTimeoutMillis(minimum); }
      catch { return minimum; }
    });
    return scheduleNoticeDismissal(() => dismissRef.current(), duration, recommendation);
  }, [key, duration, enabled]);
}
