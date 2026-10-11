import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDriveStore } from '@/stores/driveStore';
import { colors } from '@/theme';

export default function MyCarsSection() {
  const { cars, selectedCarId, selectCar } = useDriveStore();
  return <View style={styles.card}>
    <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>My cars</Text>
      <Link href="/cars" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.link}>{cars.length ? 'Manage ›' : '+ Add car'}</Text></Pressable></Link>
    </View>
    {cars.length ? cars.map(car => <Pressable key={car.id} accessibilityRole="radio" accessibilityLabel={`Use ${car.name} for trip planning`} aria-checked={car.id === selectedCarId} accessibilityState={{ selected: car.id === selectedCarId, checked: car.id === selectedCarId }} onPress={() => selectCar(car.id)} style={[styles.car, car.id === selectedCarId && styles.selected]}>
      <View style={styles.copy}><Text style={styles.name}>{car.name}</Text><Text style={styles.note}>{car.mpg} MPG · {car.tankGallons} gal tank · estimates</Text></View><Text style={styles.check}>{car.id === selectedCarId ? '✓' : '○'}</Text>
    </Pressable>) : <Text style={styles.note}>Save your car’s MPG and tank size for gas stops on your drive.</Text>}
    {!!cars.length && <Text style={styles.note}>Selected car is used when planning your next drive.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  action: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.accentDark, fontSize: 13, fontWeight: '700' },
  car: { minHeight: 64, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selected: { borderColor: colors.primary, backgroundColor: colors.paper }, copy: { flex: 1 }, name: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 }, check: { color: colors.primary, fontSize: 20 },
});
