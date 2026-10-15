import { StyleSheet } from 'react-native';
import { colors } from '@/theme';
export const dataStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingBottom: 50, gap: 16 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800' }, heading: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  card: { gap: 12, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 }, body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.surface },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: colors.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.surface, fontWeight: '800' },
  choice: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }, choiceText: { color: colors.ink, fontWeight: '700' },
  danger: { color: colors.danger, fontSize: 14, lineHeight: 21 }, disabled: { opacity: .45 }, selected: { backgroundColor: colors.paleGreen, borderColor: colors.primary },
});
