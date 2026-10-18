import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { SUBSCRIPTION_APPS } from './providerApps';
import { detectInstalledApps, launchableSubscriptionApps } from './installedAppLogic';

const native = Platform.OS !== 'web' ? requireOptionalNativeModule<{ getQuerySchemes: () => string[]; getLaunchableApps?: () => Promise<unknown>; openPackage?: (packageName: string) => Promise<boolean> }>('SubscriptionApps') : null;
export async function installedSubscriptionApps() {
  if (Platform.OS === 'android') {
    if (!native?.getLaunchableApps) return { status: 'update-required' as const, apps: [] };
    try { return { status: 'ready' as const, apps: launchableSubscriptionApps(await native.getLaunchableApps()) }; }
    catch { return { status: 'error' as const, apps: [] }; }
  }
  return detectInstalledApps(Platform.OS, SUBSCRIPTION_APPS, native?.getQuerySchemes() ?? null, Linking.canOpenURL);
}

export async function openInstalledPackage(packageName: string) {
  if (Platform.OS !== 'android' || !native?.openPackage) throw Error('Install the updated Android build to open this app.');
  return native.openPackage(packageName);
}
