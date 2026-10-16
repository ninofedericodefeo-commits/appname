import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import RenewalBanner from '@/features/subscriptions/RenewalBanner';

export function SettingsButton() {
  useThemeRevision();
  return <Link href="/settings" asChild><Pressable accessibilityRole="button" accessibilityLabel="Settings" style={styles.button}>
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 3-.5 2-2 1.2-2-.5-2 3.5 1.5 1.5v2.6L2.5 15l2 3.5 2-.5 2 1.2L9 21h4l.5-1.8 2-1.2 2 .5 2-3.5-1.5-1.7v-2.6L19.5 9l-2-3.5-2 .5-2-1.2L13 3H9Z" />
      <Path d="M15 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </Svg>
  </Pressable></Link>;
}

export function PageToolbar() {
  useThemeRevision();
  return <View><View style={styles.toolbar}><Text style={styles.brand}>GASFINDER</Text><SettingsButton /></View><RenewalBanner /></View>;
}
const styles = themedStyles(() => ({
  toolbar: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
