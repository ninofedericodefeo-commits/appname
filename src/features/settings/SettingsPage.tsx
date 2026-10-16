import { Stack } from 'expo-router';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';

export default function SettingsPage({ title, children }: PropsWithChildren<{ title: string }>) {
  useThemeRevision();
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <Stack.Screen options={{ title }} /><FormScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </FormScrollView>
  </SafeAreaView>;
}
const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 50, gap: 16 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', marginBottom: 4 },
}));
