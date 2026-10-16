import { themedStyles, useThemeRevision , colors } from '@/theme';
import type { PropsWithChildren, RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { PageToolbar } from '@/components/SettingsButton';

export function MoneyPage({ children, scrollRef }: PropsWithChildren<{ scrollRef?: RefObject<ScrollView | null> }>) {
  useThemeRevision();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <PageToolbar />
    <FormScrollView scrollRef={scrollRef} contentContainerStyle={styles.content}>{children}</FormScrollView>
  </SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 22 },
}));
