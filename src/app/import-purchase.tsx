import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useAmountsHidden, useAmountVisibility } from '@/features/preferences/amountVisibility';
import { getDataStatus, useDataStatus } from '@/features/data/operationStatus';
import { useDevicePrivacy, usePrivacySession } from '@/features/privacy/deviceStore';
import { useShortcutSetupStore } from '@/stores/shortcutSetupStore';
import { flushAppStorage } from '@/lib/appStorage';
import { formatMoney } from '@/lib/money';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { AppState, Platform, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseImportedPurchase } from '@/features/goals/importPurchase';
import { pendingWalletId, walletPurchaseId, type PendingWalletPurchase } from '@/features/goals/purchaseInbox';
import { removePendingWalletPurchase, usePendingWalletPurchases } from '@/features/goals/purchaseInboxBridge';
import { usePocketStore } from '@/stores/pocketStore';

type ImportParams = { amount?: string; merchant?: string; id?: string; currency?: string; pendingWalletId?: string };
const subscribeToAppState = (notify: () => void) => {
  const subscription = AppState.addEventListener('change', notify);
  return () => subscription.remove();
};
export default function ImportPurchaseScreen() {
  useThemeRevision();
  const params = useLocalSearchParams<ImportParams>();
  return <ImportPurchaseContent key={JSON.stringify(params)} params={params} />;
}
function ImportPurchaseContent({ params }: {params: ImportParams}) {
  useThemeRevision();
  const { busy, recoveryError } = useDataStatus();
  const amountsHidden = useAmountsHidden();
  const [openedAt] = useState(() => new Date());
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const privacyReady = useSyncExternalStore(useDevicePrivacy.persist.onFinishHydration, useDevicePrivacy.persist.hasHydrated, () => false);
  const foreground = useSyncExternalStore(subscribeToAppState, () => AppState.currentState === 'active', () => false);
  const enabled = useDevicePrivacy(state => state.enabled);
  const unlocked = usePrivacySession(state => state.unlocked);
  const [error, setError] = useState('');
  const purchases = usePocketStore((state) => state.purchases);
  const activeGoal = usePocketStore((state) => state.activeGoal);
  const { amount, merchant, id, currency } = params;
  const inbox = usePendingWalletPurchases();
  const [submittedDraft, setSubmittedDraft] = useState<PendingWalletPurchase | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pendingId = typeof params.pendingWalletId === 'string' ? params.pendingWalletId.toLowerCase() : '';
  const walletDraft = inbox.items.find(item => item.id === pendingId) ?? submittedDraft;
  const parsedLink = useMemo(() => parseImportedPurchase({ amount, merchant, id, currency }, openedAt), [amount, merchant, id, currency, openedAt]);
  const parsed = params.pendingWalletId !== undefined ? walletDraft ? { id: walletPurchaseId(walletDraft), title: walletDraft.merchant, amountCents: walletDraft.amountCents } : null : parsedLink;
  const logged = parsed ? purchases.find((item) => item.id === parsed.id) : undefined;

  const recorded = useRef(false);
  async function confirmPurchase() {
    if (!parsed || recorded.current || acknowledging) return;
    // A link supplies data, never consent. Recheck the live session at the press.
    const status = getDataStatus();
    if (!usePocketStore.persist.hasHydrated() || !useDevicePrivacy.persist.hasHydrated() ||
      status.busy || status.recoveryError || AppState.currentState !== 'active' ||
      (useDevicePrivacy.getState().hideAmounts && !useAmountVisibility.getState().revealed) ||
      (Platform.OS !== 'web' && useDevicePrivacy.getState().enabled && !usePrivacySession.getState().unlocked)) {
      setError('Unlock Savemage and wait for your account to finish loading, then try again.');
      return;
    }
    if (walletDraft) setSubmittedDraft(walletDraft);
    recorded.current = true;
    setAcknowledging(true);
    setError('');
    const pocket = usePocketStore.getState();
    try {
      const repeated = pocket.purchases.some(item => item.id === parsed.id);
      if (!repeated && !pocket.addPurchase(parsed.id, parsed.title, parsed.amountCents, undefined, 'shortcut', walletDraft?.capturedAt)) throw new Error('Could not save this purchase. Check your account and try again.');
      useShortcutSetupStore.getState().recordCapture(repeated ? 'repeated' : 'received');
      if (walletDraft) {
        // Retrying after a storage failure must enqueue a fresh durable write.
        if (repeated) usePocketStore.setState({ purchases: [...usePocketStore.getState().purchases] });
        // Preserve the capture until the explicit save is durably stored.
        await flushAppStorage();
        await removePendingWalletPurchase(walletDraft.id);
      }
      setCompleted(true);
    } catch (cause) {
      recorded.current = false;
      setError(cause instanceof Error ? cause.message : 'Could not save this purchase. Try again.');
    } finally { setAcknowledging(false); }
  }

  const waitingForInbox = params.pendingWalletId !== undefined && pendingWalletId(params.pendingWalletId) && inbox.loading && !walletDraft;
  const result = !ready || waitingForInbox ? 'waiting' : !parsed ? 'invalid' : !logged ? 'review' : logged.decision === 'saved' ? 'saved' : 'pending';
  const details = parsed ? `${parsed.title} · ${formatMoney(parsed.amountCents)}` : '';
  const canConfirm = !amountsHidden && !acknowledging && ready && privacyReady && foreground && !busy && !recoveryError && (Platform.OS === 'web' || !enabled || unlocked);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>PURCHASE IMPORT</Text>
    <Text accessibilityRole="header" style={styles.title}>{result === 'saved' ? 'Purchase recorded' : result === 'pending' ? 'Purchase logged' : result === 'review' ? 'Review purchase' : result === 'invalid' ? 'Could not import' : 'Opening your account…'}</Text>
    <Text style={styles.body}>{result === 'saved' ? `${details} · ${formatMoney(logged?.savedCents ?? 0)} included in your set-aside estimate` : result === 'pending' ? `${details}. ${activeGoal ? 'Review any savings suggestion in Account → Transactions.' : 'Create a goal to begin setting money aside. Find this purchase in Account → Transactions.'}` : result === 'review' ? `${details}\nSave this purchase only if you recognize it. Your goal’s rule applies after you save.` : result === 'invalid' ? params.pendingWalletId !== undefined ? 'This pending Wallet draft is unavailable or expired. Open Wallet purchases to refresh the list.' : 'The link needs a merchant and a positive USD amount. Other currencies are not supported. Check the Shortcuts automation.' : 'Loading saved goals and purchases.'}</Text>
    {result === 'review' && <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canConfirm }} disabled={!canConfirm} style={[styles.button, !canConfirm && styles.disabled]} onPress={() => confirmPurchase()}><Text style={styles.buttonText}>{acknowledging ? 'Saving…' : 'Save purchase'}</Text></Pressable>}
    {logged && walletDraft && !completed && <Pressable accessibilityRole="button" disabled={!canConfirm} style={styles.button} onPress={() => confirmPurchase()}><Text style={styles.buttonText}>Remove saved draft</Text></Pressable>}
    {!!inbox.error && params.pendingWalletId !== undefined && <Text accessibilityRole="alert" style={styles.error}>{inbox.error}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Link href="/account-transactions" replace asChild><Pressable accessibilityRole="button" style={result === 'review' ? styles.cancel : styles.button}><Text style={result === 'review' ? styles.cancelText : styles.buttonText}>{result === 'review' ? 'Cancel' : 'Open transactions'}</Text></Pressable></Link>
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.ink, padding: 15, borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: colors.surface, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  cancel: { padding: 15, alignSelf: 'flex-start' },
  cancelText: { color: colors.ink, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 16, lineHeight: 24 },
}));
