import { useId, type Ref } from 'react';
import { Text, TextInput, View, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import { colors, themedStyles, useThemeRevision } from '@/theme';
type Props = Omit<TextInputProps,'accessibilityLabel' | 'style'> & {
  label: string; hint?: string; error?: string; style?: StyleProp<TextStyle>; ref?: Ref<TextInput>;
};
export function AccessibleField({ label, hint, error, style, ref, ...props }: Props) {
  useThemeRevision();
  const id = useId(), descriptions = [hint && `${id}-hint`,error && `${id}-error`].filter(Boolean).join(' ');
  return <View style={styles.field}>
    <Text nativeID={`${id}-label`} style={styles.label}>{label}</Text>
    {hint && <Text nativeID={`${id}-hint`} style={styles.hint}>{hint}</Text>}
    <TextInput {...props} ref={ref} accessibilityLabel={label} accessibilityHint={[hint,error && `Error: ${error}`].filter(Boolean).join(' ')} aria-invalid={!!error} aria-describedby={descriptions || undefined} style={[styles.input,style,error && styles.invalid]} />
    {!!error && <Text nativeID={`${id}-error`} style={styles.error}>Error: {error}</Text>}
  </View>;
}
const styles = themedStyles(() => ({
  field: { gap: 7 }, label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 },
  invalid: { borderColor: colors.danger, borderWidth: 2 }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
}));
