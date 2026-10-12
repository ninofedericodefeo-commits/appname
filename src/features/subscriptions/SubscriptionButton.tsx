import { Pressable, StyleSheet, Text } from 'react-native';
import type { AccessibilityState } from 'react-native';
import { colors } from '@/theme';

export default function SubscriptionButton({ label, onPress, tone = 'secondary', disabled = false, accessibilityLabel,
  accessibilityState, grow = false }: { label: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean; accessibilityLabel?: string; accessibilityState?: AccessibilityState; grow?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ ...accessibilityState, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, grow && styles.grow, tone === 'primary' && styles.primary,
      tone === 'danger' && styles.danger, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.label, tone === 'primary' && styles.primaryLabel, tone === 'danger' && styles.dangerLabel]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 46, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, maxWidth: '100%' },
  grow: { flex: 1 }, primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  danger: { backgroundColor: colors.dangerPale, borderColor: colors.danger }, dim: { opacity: .55 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 19 },
  primaryLabel: { color: colors.surface }, dangerLabel: { color: colors.danger },
});
