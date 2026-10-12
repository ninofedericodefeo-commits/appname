import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { SUBSCRIPTION_APPS } from './providerApps';
import { detectInstalledApps } from './installedAppLogic';

const native = Platform.OS !== 'web' ? requireOptionalNativeModule<{ getQuerySchemes: () => string[] }>('SubscriptionApps') : null;
export function installedSubscriptionApps() {
  return detectInstalledApps(Platform.OS, SUBSCRIPTION_APPS, native?.getQuerySchemes() ?? null, Linking.canOpenURL);
}
