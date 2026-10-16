import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useDataStatus } from '@/features/data/operationStatus';
import { useShortcutSetupStore } from '@/stores/shortcutSetupStore';
import { formatMoney } from '@/lib/money';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseImportedPurchase } from '@/features/goals/importPurchase';
import { usePocketStore } from '@/stores/pocketStore';

type ImportParams = { amount?: string; merchant?: string; id?: string; currency?: string };
export default function ImportPurchaseScreen() {
  useThemeRevision();
  const params = useLocalSearchParams<ImportParams>();
  return <ImportPurchaseContent key={JSON.stringify(params)} params={params} />;
}
function ImportPurchaseContent({ params }: {params: ImportParams}) {
  useThemeRevision();
  const { busy, recoveryError } = useDataStatus();
  const [openedAt] = useState(() => new Date());
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const purchases = usePocketStore((state) => state.purchases);
  const activeGoal = usePocketStore((state) => state.activeGoal);
  const { amount, merchant, id, currency } = params;
  const parsed = useMemo(() => parseImportedPurchase({ amount, merchant, id, currency }, openedAt), [amount, merchant, id, currency, openedAt]);
  const logged = parsed ? purchases.find((item) => item.id === parsed.id) : undefined;

  const recorded = useRef(false);
  useEffect(() => {
    if (!ready || busy || recoveryError || recorded.current) return;
    recorded.current = true;
    let outcome: 'received' | 'repeated' | 'invalid' | 'failed' = !parsed ? 'invalid' : logged ? 'repeated' : 'failed';
    try { if (parsed && !logged && usePocketStore.getState().addPurchase(parsed.id, parsed.title, parsed.amountCents, undefined, 'shortcut')) outcome = 'received'; }
    catch { outcome = 'failed'; }
    useShortcutSetupStore.getState().recordCapture(outcome);
  }, [ready, busy, recoveryError, parsed, logged]);

  const result = !ready ? 'waiting' : !parsed ? 'invalid' : !logged ? 'waiting' : logged.decision === 'saved' ? 'saved' : 'pending';
  const details = parsed ? `${parsed.title} · ${formatMoney(parsed.amountCents)}` : '';

  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Text style={styles.kicker}>PURCHASE IMPORT</Text>
    <Text accessibilityRole="header" style={styles.title}>{result === 'saved' ? 'Purchase recorded' : result === 'pending' ? 'Purchase logged' : result === 'invalid' ? 'Could not import' : 'Opening your account…'}</Text>
    <Text style={styles.body}>{result === 'saved' ? `${details} · ${formatMoney(logged?.savedCents ?? 0)} included in your set-aside estimate` : result === 'pending' ? `${details}. ${activeGoal ? 'Your rule could not set money aside; review this purchase in Account → Transactions.' : 'Create a goal to begin setting money aside. Find this purchase in Account → Transactions.'}` : result === 'invalid' ? 'The link needs a merchant and a positive USD amount. Other currencies are not supported. Check the Shortcuts automation.' : 'Loading saved goals and purchases.'}</Text>
    <Link href="/account-transactions" asChild><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Open transactions</Text></Pressable></Link>
  </View></SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.ink, padding: 15, borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: colors.surface, fontWeight: '800' },
}));
