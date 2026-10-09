import { colors } from '@/theme';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseImportedPurchase } from '@/features/goals/importPurchase';
import { usePocketStore } from '@/stores/pocketStore';

export default function ImportPurchaseScreen() {
  const params = useLocalSearchParams<{ amount?: string; merchant?: string; id?: string }>();
  const [openedAt] = useState(() => new Date());
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const purchases = usePocketStore((state) => state.purchases);
  const activeGoal = usePocketStore((state) => state.activeGoal);
  const { amount, merchant, id } = params;
  const parsed = useMemo(() => parseImportedPurchase({ amount, merchant, id }, openedAt), [amount, merchant, id, openedAt]);
  const logged = parsed ? purchases.find((item) => item.id === parsed.id) : undefined;

  useEffect(() => {
    if (ready && parsed && !logged) {
      usePocketStore.getState().addPurchase(parsed.id, parsed.title, parsed.amountCents, undefined, 'shortcut');
    }
  }, [ready, parsed, logged]);

  const result = !ready ? 'waiting' : !parsed ? 'invalid' : !logged ? 'waiting' : logged.decision === 'saved' ? 'saved' : 'pending';
  const details = parsed ? `${parsed.title} · $${(parsed.amountCents / 100).toFixed(2)}` : '';

  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Text style={styles.kicker}>PURCHASE IMPORT</Text>
    <Text style={styles.title}>{result === 'saved' ? 'Purchase recorded' : result === 'pending' ? 'Purchase logged' : result === 'invalid' ? 'Could not import' : 'Opening your pocket…'}</Text>
    <Text style={styles.body}>{result === 'saved' ? `${details} · $${((logged?.savedCents ?? 0) / 100).toFixed(2)} included in your pocket estimate` : result === 'pending' ? `${details}. ${activeGoal ? 'Your rule could not set money aside; review this purchase in Goals.' : 'Create a goal to begin setting money aside. Find this purchase in Subs → Activity.'}` : result === 'invalid' ? 'The link needs a merchant and a positive USD amount. Check the Shortcuts automation.' : 'Loading saved goals and purchases.'}</Text>
    <Link href={{ pathname: '/investment', params: { section: 'goals' } }} asChild><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Open savings goals</Text></Pressable></Link>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.ink, padding: 15, borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: colors.surface, fontWeight: '800' },
});
