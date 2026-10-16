import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useDriveStore } from '@/stores/driveStore';

export default function MyCarsSection() {
  useThemeRevision();
  const { cars, selectedCarId } = useDriveStore();
  const selected = cars.find(car => car.id === selectedCarId) ?? cars[0];
  return <View style={styles.card}>
    <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>My cars</Text>
      <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.link}>{cars.length ? 'Manage ›' : '+ Add car'}</Text></Pressable></Link>
    </View>
    {selected ? <Text style={styles.name}>{selected.name} · selected for your next drive</Text> : <Text style={styles.note}>Add a car to plan fuel stops on your drive.</Text>}
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 8, marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  action: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.accentDark, fontSize: 13, fontWeight: '700' },
  name: { color: colors.ink, fontWeight: '700', fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
}));
