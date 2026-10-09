import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import type { RefObject } from 'react';

// iOS adjusts insets and the focused input together. Android resizes the form.
export function FormScrollView({ scrollRef, ...props }: ScrollViewProps & { scrollRef?: RefObject<ScrollView | null> }) {
  const internalScroll = useRef<ScrollView>(null);
  const scroll = scrollRef ?? internalScroll;
  const focused = useRef<number | null>(null);
  const reveal = useCallback(() => {
    if (focused.current !== null && Platform.OS !== 'web') scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused.current, 24, true);
  }, [scroll]);
  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', reveal);
    return () => listener.remove();
  }, [reveal]);
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
