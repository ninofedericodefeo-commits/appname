import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { colors, themedStyles, useThemeRevision } from '@/theme';

export function NoticeCard({ message, action = 'Dismiss', actionLabel, onAction, warning = false }: {
  message: string; action?: string; actionLabel: string; onAction: () => void; warning?: boolean;
}) {
  useThemeRevision();
  const { height } = useWindowDimensions();
  return <View style={[styles.notice, warning && styles.warning]}>
    <ScrollView style={{ maxHeight: Math.max(80, height * 0.3), flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.content}>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.button}><Text style={styles.label}>{action}</Text></Pressable>
    </ScrollView>
  </View>;
}

const styles = themedStyles(() => ({
  notice: { marginHorizontal: 12, marginTop: 8, backgroundColor: colors.paleGreen, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, flexShrink: 1 },
  warning: { backgroundColor: colors.paleOrange },
  content: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  message: { color: colors.ink, fontSize: 14, lineHeight: 21, flexGrow: 1, flexShrink: 1, flexBasis: 190 },
  button: { minHeight: 44, minWidth: 60, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  label: { color: colors.primary, fontWeight: '700', fontSize: 14 },
}));
