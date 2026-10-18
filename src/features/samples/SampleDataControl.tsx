import { Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors, themedStyles, useThemeRevision } from '@/theme';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { useSampleDataStore } from './store';

export default function SampleDataControl({ onPreviewStatement, compact = false, onVisibilityChange }: {
  onPreviewStatement?: () => void; compact?: boolean; onVisibilityChange?: (visible: boolean) => void;
}) {
  useThemeRevision();
  const pathname = usePathname();
  const { visible, setVisible } = useSampleDataStore();
  return <View style={styles.card}>
    <View style={styles.header}><Text style={styles.title}>Sample data{visible ? ' is on' : ' is hidden'}</Text>
      <SubscriptionButton label={visible ? 'Hide sample data' : 'Show sample data'} accessibilityState={{ expanded: visible }}
        onPress={() => { setVisible(!visible); onVisibilityChange?.(!visible); }} /></View>
    {!compact && <Text style={styles.note}>{visible ? 'Example values are labeled Sample. ' : ''}Your real records and balances stay unchanged.</Text>}
    {visible && onPreviewStatement && <SubscriptionButton label="View sample Citizens statement" onPress={onPreviewStatement} />}
    {visible && pathname !== '/sample-data' && <SubscriptionButton label="Explore sample data" onPress={() => router.push('/sample-data')} />}
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.tint, borderRadius: 12, padding: 16, gap: 10, borderColor: colors.line, borderWidth: 1 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
}));
