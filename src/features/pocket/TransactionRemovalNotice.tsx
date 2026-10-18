import { themedStyles, useThemeRevision , colors } from '@/theme';
import { Pressable, Text, View } from 'react-native';


export function TransactionRemovalNotice({ onUndo }: { onUndo: () => void }) {
  useThemeRevision();
  return <View style={styles.notice}>
    <Text accessibilityLiveRegion="polite" style={styles.text}>Hidden from history</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Undo transaction removal" onPress={onUndo} style={styles.button}><Text style={styles.undo}>Undo</Text></Pressable>
  </View>;
}

const styles = themedStyles(() => ({
  notice: { backgroundColor: colors.paleGreen, borderRadius: 10, paddingLeft: 14, paddingRight: 6, margin: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  text: { color: colors.ink, fontSize: 13, flexShrink: 1 },
  button: { minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  undo: { color: colors.primary, fontWeight: '800', fontSize: 14 },
}));
