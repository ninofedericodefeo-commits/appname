import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

/** Headerless screen shell. Apply measured insets in the same render as content,
 * rather than waiting for a native SafeAreaView padding update after mounting a
 * tab. Screens with a native navigation header must omit the top edge. */
export function ScreenSafeArea({ edges, style, ...props }: ViewProps & { edges: readonly Edge[] }) {
  const insets = useSafeAreaInsets();
  return <View {...props} style={[
    { paddingTop: edges.includes('top') ? insets.top : 0,
      paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
      paddingLeft: edges.includes('left') ? insets.left : 0,
      paddingRight: edges.includes('right') ? insets.right : 0 },
    style,
  ]} />;
}
