import { Pressable, Text, View } from 'react-native';
import { useDataStatus, updateDataStatus } from './operationStatus';
import { colors, useThemeRevision } from '@/theme';
export default function DataCompletionNotice() {
  useThemeRevision();
  const { notice } = useDataStatus();
  if (!notice) return null;
  return <View style={{ backgroundColor: colors.paleGreen, borderTopWidth: 1, borderColor: colors.lineStrong, padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.ink, flex: 1, minWidth: 150, fontSize: 14 }}>{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss data completion notice" style={{ minHeight: 44, minWidth: 60, justifyContent: 'center' }} onPress={() => updateDataStatus({ notice: '' })}><Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text></Pressable></View>;
}
