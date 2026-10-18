import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { useSampleDataStore } from '@/features/samples/store';
import { SampleCarsPreview, SampleFillupsPreview, SampleFuelStatisticsPreview, SampleInsightsPreview, SamplePastGoalsPreview, SampleReceiptPreview } from '@/features/samples/SampleActivityPreviews';
import { sampleSpendingSummary } from '@/features/samples/activityFixtures';
import { formatMoney } from '@/lib/money';
import { useThemeRevision } from '@/theme';

export default function SampleActivityScreen() {
  useThemeRevision();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const visible = useSampleDataStore(state => state.visible);
  const isReceipt = typeof id === 'string' && id.startsWith('sample-refill-');
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={s.safe}><Stack.Screen options={{ title: 'Sample activity' }} /><FormScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>Sample activity</Text><Text style={s.note}>Fictional examples. Nothing here is saved to your accounts, garage or financial records.</Text><SampleDataControl compact />
    {visible && <>{isReceipt ? <SampleReceiptPreview id={id} /> : id === 'sample-spending' ? <><SampleInsightsPreview />{sampleSpendingSummary().selected.map(row => <Text key={row.id} style={s.body}>{row.sourceDate} · {row.title} · {formatMoney(row.amountCents)}</Text>)}</> : <><SampleCarsPreview /><SampleFuelStatisticsPreview /><SampleFillupsPreview /><SampleInsightsPreview /><SamplePastGoalsPreview /></>}</>}
  </FormScrollView></SafeAreaView>;
}
