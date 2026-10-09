import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

export type ActionIcon = 'edit' | 'delete' | 'settings' | 'activity' | 'upload' | 'close';

const paths: Record<ActionIcon, string> = {
  edit: 'm16 3 5 5M3 21l5-1L20 8a3.54 3.54 0 0 0-5-5L3 15v6Z',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  settings: 'm9.5 3-.6 2.3-2 .9-2.1-.7-2.5 4.3 1.6 1.6v2.3l-1.6 1.6 2.5 4.3 2.1-.7 2 .9.6 2.2h5l.6-2.2 2-.9 2.1.7 2.5-4.3-1.6-1.6v-2.3l1.6-1.6-2.5-4.3-2.1.7-2-.9-.6-2.3h-5Z',
  activity: 'M4 7h10M4 12h7M4 17h7M17 10v5l3 2',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  close: 'm6 6 12 12M6 18 18 6',
};

export function IconButton({ icon, label, onPress, inverse = false, selected = false }: {
  icon: ActionIcon; label: string; onPress: () => void; inverse?: boolean; selected?: boolean;
}) {
  const stroke = inverse ? colors.surface : colors.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [styles.button, inverse && styles.inverse, selected && styles.selected, pressed && styles.pressed]}>
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d={paths[icon]} />
      {icon === 'settings' && <Circle cx={12} cy={12} r={3} />}
      {icon === 'activity' && <Circle cx={17} cy={15} r={6} />}
    </Svg>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  inverse: { backgroundColor: 'rgba(255,255,255,0.08)' },
  selected: { backgroundColor: colors.paleGreen },
  pressed: { opacity: 0.6 },
});
