import type { PropsWithChildren, RefObject } from 'react';
import { StyleSheet } from 'react-native';
import type { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';

export function MoneyPage({ children, scrollRef }: PropsWithChildren<{ scrollRef?: RefObject<ScrollView | null> }>) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <FormScrollView scrollRef={scrollRef} contentContainerStyle={styles.content}>{children}</FormScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 22 },
});
