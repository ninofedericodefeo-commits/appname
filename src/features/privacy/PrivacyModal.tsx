import { useSyncExternalStore } from 'react';
import { AppState, Modal, Platform, type ModalProps } from 'react-native';
import { usePathname } from 'expo-router';
import { useAmountsHidden } from '@/features/preferences/amountVisibility';
import { useDevicePrivacy, usePrivacySession } from './deviceStore';
import { isFinancialRoute } from './financialRoutes';

const subscribe = (notify: () => void) => {
  const subscription = AppState.addEventListener('change', notify);
  return () => subscription.remove();
};

// A native Modal escapes an ancestor's opacity. Hide it at its own boundary,
// keeping the screen and navigator mounted through pickers and app handoffs.
export function PrivacyModal({ visible = true, ...props }: ModalProps) {
  const enabled = useDevicePrivacy(state => state.enabled);
  const unlocked = usePrivacySession(state => state.unlocked);
  const hydrated = useSyncExternalStore(useDevicePrivacy.persist.onFinishHydration, useDevicePrivacy.persist.hasHydrated, () => false);
  const foreground = useSyncExternalStore(subscribe, () => AppState.currentState === 'active', () => false);
  const hiddenAmounts = useAmountsHidden();
  const pathname = usePathname();
  const blocked = !hydrated || hiddenAmounts && isFinancialRoute(pathname) || Platform.OS !== 'web' && (enabled && !unlocked || !foreground);
  return <Modal {...props} visible={visible && !blocked} />;
}
