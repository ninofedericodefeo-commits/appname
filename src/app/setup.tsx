import { Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePocketStore } from '@/stores/pocketStore';
import { useDriveStore } from '@/stores/driveStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import SettingsPage from '@/features/settings/SettingsPage';
import Button from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';
export default function SetupScreen() {
  useThemeRevision();
  const account = usePocketStore(state => state.reportedBalanceCents !== null), car = useDriveStore(state => state.cars.length > 0), subscriptions = useSubscriptionStore(state => state.subscriptions.some(sub => !sub.isSample));
  return <SettingsPage title="Quick setup & help"><Stack.Screen options={{ title: 'Quick setup' }} /><Text style={s.note}>Use only what you need. All setup is optional; shortcuts are never required for normal use.</Text><View style={s.card}><Text accessibilityRole="header" style={s.heading}>{account ? '✓ ' : ''}Account</Text><Text style={s.note}>Import a Citizens checking/savings PDF or CSV, review its transactions and choose whether to use its closing balance. Estimated available subtracts your set-asides. It is as current as your saved evidence.</Text><Button label="Choose bank PDF or CSV" onPress={() => router.push('/bank-import')} /></View><View style={s.card}><Text accessibilityRole="header" style={s.heading}>{car ? '✓ ' : ''}Gas & cars</Text><Text style={s.note}>Search a city or ZIP without GPS. Map and List show reported prices or N/A. Save a car only if you want fuel-range planning.</Text><Button label="Open Gas" onPress={() => router.navigate('/')} /><Button label="Manage cars" onPress={() => router.push('/cars')} /></View><View style={s.card}><Text accessibilityRole="header" style={s.heading}>{subscriptions ? '✓ ' : ''}Subscriptions</Text><Text style={s.note}>Add real services manually or review bank suggestions. Set the billing destination to start cancellation with the provider. GasFinder cannot cancel on your behalf. Samples and phone reminders are optional in Settings.</Text><Button label="Open Subscriptions" onPress={() => router.navigate('/subscriptions')} /></View><Button label="Done / skip setup" tone="primary" onPress={() => { useSettingsStore.getState().configure({ setupDismissed: true }); router.back(); }} /></SettingsPage>;
}
