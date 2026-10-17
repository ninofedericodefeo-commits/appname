import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useDriveStore } from '@/stores/driveStore';
import { AppIcon } from '@/components/AppIcon';

export default function MyCarsSection() {
  useThemeRevision();
  const { cars, selectedCarId } = useDriveStore();
  const selected = cars.find(car => car.id === selectedCarId) ?? cars[0];
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.titleRow}><AppIcon name="car" color={colors.primary} size={22} /><Text accessibilityRole="header" style={styles.title}>My cars</Text></View>
      <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.link}>{cars.length ? 'Manage' : 'Add car'}</Text></Pressable></Link>
    </View>
    {selected ? <Text style={styles.name}>{selected.name} · selected for your next drive</Text> : <Text style={styles.note}>Add your car for fuel stop estimates.</Text>}
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 6 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  action: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }, link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  name: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 }, note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.6 },
}));
