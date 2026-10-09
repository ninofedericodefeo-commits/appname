import { useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import type { ScrollViewProps } from 'react-native';

// iOS adjusts insets and the focused input together. Android resizes the form.
export function FormScrollView(props: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const focused = useRef<number | null>(null);
  const reveal = () => {
    if (focused.current !== null && Platform.OS !== 'web') scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused.current, 24, true);
  };
  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', reveal);
    return () => listener.remove();
  }, []);
  const form = <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} {...props} automaticallyAdjustKeyboardInsets onFocus={(event) => {
    props.onFocus?.(event);
    focused.current = event.nativeEvent.target;
    if (Keyboard.isVisible()) requestAnimationFrame(reveal);
  }} onBlur={(event) => { focused.current = null; props.onBlur?.(event); }} />;
  return Platform.OS === 'android'
    ? <KeyboardAvoidingView behavior="height" style={styles.fill}>{form}</KeyboardAvoidingView>
    : form;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
