import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type SafariBlockerStatus = { bundled: boolean; enabled: boolean | null; settingsSupported: boolean };
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<{
  getStatus: () => Promise<SafariBlockerStatus>;
  openSettings: () => Promise<void>;
}>('SpendingBlocker') : null;

export async function safariBlockerStatus(): Promise<SafariBlockerStatus> {
  return native ? native.getStatus() : { bundled: false, enabled: null, settingsSupported: false };
}

export async function openSafariBlockerSettings() {
  if (!native) throw new Error('Install the updated GasFinder iPhone build, then open Settings → Apps → Safari → Extensions.');
  await native.openSettings();
}
