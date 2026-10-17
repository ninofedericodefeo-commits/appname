import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import RenewalBanner from '@/features/subscriptions/RenewalBanner';
import { AppIcon } from './AppIcon';

export function SettingsButton() {
  useThemeRevision();
  return <Link href="/settings" asChild><Pressable accessibilityRole="button" accessibilityLabel="Settings" style={styles.button}>
    <AppIcon name="settings" size={23} color={colors.primary} />
  </Pressable></Link>;
}

export function PageToolbar({ brandHidden = false, maxWidth = 760 }: { brandHidden?: boolean; maxWidth?: number }) {
  useThemeRevision();
  return <View style={[styles.container, { maxWidth }]}><View style={styles.toolbar}>{brandHidden ? <View /> : <Text maxFontSizeMultiplier={1.5} style={styles.brand}>GasFinder</Text>}<SettingsButton /></View><RenewalBanner /></View>;
}
const styles = themedStyles(() => ({
  container: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  toolbar: { width: '100%', minHeight: 52, paddingLeft: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.muted, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.tint },
}));
