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
  return <SettingsPage title="Quick setup & help"><Stack.Screen options={{ title: 'Quick setup' }} />
    <Text style={s.note}>Start with your account, give savings a goal, and keep bills in view. Use only what you need; all setup is optional.</Text>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{account ? '✓ ' : ''}Account</Text>
      <Text style={s.note}>Import a Citizens checking/savings PDF or CSV, review its transactions and choose whether to use its closing balance. Estimated available subtracts your set-asides. It is as current as your saved evidence.</Text>
      <Button label="Choose bank PDF or CSV" onPress={() => router.push('/bank-import')} />
      <Button label="Open Account" onPress={() => router.navigate('/pocket')} />
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Goals</Text>
      <Text style={s.note}>Choose something to save for and track your set-asides toward it. Your plan stays in Centsward; no money moves between bank accounts.</Text>
      <Button label="Open Goals" onPress={() => router.navigate('/investment')} />
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{subscriptions ? '✓ ' : ''}Bills</Text>
      <Text style={s.note}>Add recurring services manually or review bank suggestions. Set the billing destination to start cancellation with the provider. Centsward cannot cancel on your behalf. Samples and phone reminders are optional in Settings.</Text>
      <Button label="Open Bills" onPress={() => router.navigate('/subscriptions')} />
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{car ? '✓ ' : ''}Gas & cars</Text>
      <Text style={s.note}>Compare fuel stops when you need them. Search a city or ZIP without GPS. Map and List show reported prices or N/A. Save a car only if you want fuel-range planning.</Text>
      <Button label="Open Gas" onPress={() => router.navigate('/')} />
      <Button label="Manage cars" onPress={() => router.push('/cars')} />
    </View>
    <Button label="Done / skip setup" tone="primary" onPress={() => { useSettingsStore.getState().configure({ setupDismissed: true }); router.back(); }} />
  </SettingsPage>;
}
