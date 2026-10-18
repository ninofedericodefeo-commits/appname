import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Normal layout keeps notices clear of the navigator and each other. */
export function BottomNoticeArea({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  return <KeyboardAvoidingView enabled={height > 0} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flexShrink: 1 }}>
    <View style={{ paddingBottom: height > 0 ? Math.max(8, insets.bottom) : 0, paddingLeft: insets.left, paddingRight: insets.right, flexShrink: 1 }}>
      <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ flexShrink: 1 }}>{children}</View>
    </View>
  </KeyboardAvoidingView>;
}
