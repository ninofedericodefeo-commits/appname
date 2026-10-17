import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Pressable, Text } from 'react-native';
import type { AccessibilityState } from 'react-native';

export default function SubscriptionButton({ label, onPress, tone = 'secondary', disabled = false, accessibilityLabel,
  accessibilityState, grow = false }: { label: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean; accessibilityLabel?: string; accessibilityState?: AccessibilityState; grow?: boolean }) {
  useThemeRevision();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    aria-pressed={accessibilityState?.selected} accessibilityState={{ ...accessibilityState, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, grow && styles.grow, tone === 'primary' && styles.primary,
      tone === 'danger' && styles.danger, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.label, tone === 'primary' && styles.primaryLabel, tone === 'danger' && styles.dangerLabel]}>{label}</Text>
  </Pressable>;
}
const styles = themedStyles(() => ({
  button: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, maxWidth: '100%' },
  grow: { flex: 1 }, primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  danger: { backgroundColor: colors.dangerPale, borderColor: colors.danger }, dim: { opacity: .55 },
  label: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21 },
  primaryLabel: { color: colors.onPrimary }, dangerLabel: { color: colors.danger },
}));
