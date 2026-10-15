import { Platform } from 'react-native';
import { usePrivacySession } from './deviceStore';
export async function authenticateDevice() {
  if (Platform.OS === 'web') throw new Error('Device authentication is available in the iPhone and Android app.');
  const Authentication = await import('expo-local-authentication').catch(() => { throw new Error('Device authentication needs the updated GasFinder native build.'); });
  const level = await Authentication.getEnrolledLevelAsync();
  if (level === Authentication.SecurityLevel.NONE) throw new Error('Set up a device passcode or biometrics in phone Settings first.');
  const result = await Authentication.authenticateAsync({ promptMessage: 'Unlock GasFinder', cancelLabel: 'Cancel', disableDeviceFallback: false, biometricsSecurityLevel: 'strong' });
  if (!result.success) throw new Error(result.error === 'not_available' ? 'Authentication needs an updated native app build and a supported device.' : 'Authentication did not finish. Your app stays locked.');
  usePrivacySession.setState({ unlocked: true });
}
