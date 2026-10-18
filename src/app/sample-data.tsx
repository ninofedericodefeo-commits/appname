import { Stack, router } from 'expo-router';
import { Text, View } from 'react-native';
import { MoneyPage } from '@/components/MoneyPage';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { useSampleDataStore } from '@/features/samples/store';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';

export default function SampleDataScreen() {
  useThemeRevision();
  const visible = useSampleDataStore(state => state.visible);
  return <MoneyPage nativeHeader>
    <Stack.Screen options={{ title: 'Sample data' }} />
    <Text accessibilityRole="header" style={s.title}>Explore sample data</Text>
    <Text style={s.note}>See populated examples without entering your own records. All invented records are labeled Sample. Your real records stay visible alongside them.</Text>
    {visible ? <>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Gas & driving</Text>
        <Text style={s.note}>Individual stations, fuel prices and history, cars, fill-ups and receipts.</Text>
        <SubscriptionButton label="Explore sample stations" onPress={() => router.push('/')} />
        <SubscriptionButton label="Open an individual sample station" onPress={() => router.push({ pathname: '/sample-station', params: { id: 'sample-station-river' } })} />
        <SubscriptionButton label="View sample cars" onPress={() => router.push('/cars')} />
        <SubscriptionButton label="View sample receipts" onPress={() => router.push('/report-receipt')} />
        <SubscriptionButton label="View sample driving history & fuel costs" onPress={() => router.push('/sample-activity')} />
      </View>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Account & spending</Text>
        <Text style={s.note}>A sample checking balance, signed transactions, a matching Citizens-style statement and spending summaries.</Text>
        <SubscriptionButton label="View sample account" onPress={() => router.push('/pocket')} />
        <SubscriptionButton label="View sample Citizens statement" onPress={() => router.push('/sample-statement')} />
        <SubscriptionButton label="View sample insights" onPress={() => router.push('/insights')} />
      </View>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Goals & bills</Text>
        <Text style={s.note}>Savings progress, completed goals and upcoming recurring charges.</Text>
        <SubscriptionButton label="View sample goals" onPress={() => router.push('/investment')} />
        <SubscriptionButton label="View sample bills" onPress={() => router.push('/subscriptions')} />
      </View>
      <Text style={s.note}>Samples are previews. They do not change your real totals, exports, reminders or saved records. Hide sample data at any time to see only your records.</Text>
    </> : <Text style={s.note}>Samples are hidden throughout the app. Show sample data below to explore the examples.</Text>}
    <SampleDataControl />
  </MoneyPage>;
}
