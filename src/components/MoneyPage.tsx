import { themedStyles, useThemeRevision , colors } from '@/theme';
import type { PropsWithChildren, RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { ScreenSafeArea as SafeAreaView } from './ScreenSafeArea';

import { FormScrollView } from '@/components/FormScrollView';
import { PageToolbar } from '@/components/SettingsButton';

export function MoneyPage({ children, scrollRef, nativeHeader = false }: PropsWithChildren<{ scrollRef?: RefObject<ScrollView | null>; nativeHeader?: boolean }>) {
  useThemeRevision();
  return <SafeAreaView edges={nativeHeader ? ['left', 'right', 'bottom'] : ['top', 'left', 'right']} style={styles.safe}>
    {!nativeHeader && <PageToolbar />}
    <FormScrollView scrollRef={scrollRef} contentContainerStyle={styles.content}>{children}</FormScrollView>
  </SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, gap: 22 },
}));
