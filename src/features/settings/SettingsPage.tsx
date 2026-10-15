import type { PropsWithChildren } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';

export default function SettingsPage({ title, children }: PropsWithChildren<{ title: string }>) {
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </FormScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 50, gap: 16 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', marginBottom: 4 },
});
