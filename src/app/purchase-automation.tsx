import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { installPurchaseShortcut } from '@/features/goals/installShortcut';
import { automationSetupURL, firstSetupPurchase, PURCHASE_SHORTCUT_NAME } from '@/features/goals/shortcutSetup';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { useShortcutSetupStore } from '@/stores/shortcutSetupStore';
import { colors } from '@/theme';

const isIPhone = Platform.OS === 'ios';
const modernShortcuts = isIPhone && Number.parseInt(String(Platform.Version), 10) >= 27;

type Handoff = { opened: boolean; leftApp: boolean; returned: boolean };

function Button({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text>
  </Pressable>;
}

function TapPath({ labels }: { labels: string[] }) {
  return <View style={styles.path}>{labels.map((label, index) => <View key={label} style={styles.pathPart}>
    {index > 0 && <Text style={styles.arrow}>›</Text>}<Text style={styles.tap}>{label}</Text>
  </View>)}</View>;
}

export default function PurchaseAutomationScreen() {
  const { stage, verificationStartedAt, connectCard, awaitPurchase, restart } = useShortcutSetupStore();
  const hydrated = useSyncExternalStore(useShortcutSetupStore.persist.onFinishHydration,
    useShortcutSetupStore.persist.hasHydrated, () => false);
  const purchases = usePocketStore((state) => state.purchases);
  const received = stage === 'verify' ? firstSetupPurchase(purchases, verificationStartedAt) : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [unifiedAutomations, setUnifiedAutomations] = useState(modernShortcuts || Platform.OS === 'web');
  const handoff = useRef<Handoff | null>(null);
  const stepNumber = stage === 'install' ? 1 : stage === 'automation' ? 2 : 3;

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      const pending = handoff.current;
      if (!pending) return;
      if (state !== 'active') pending.leftApp = true;
      else if (pending.leftApp) {
        pending.returned = true;
        if (pending.opened) {
          handoff.current = null;
          // Returning only starts the test. It does not prove a trigger was saved.
          awaitPurchase();
        }
      }
    });
    return () => listener.remove();
  }, [awaitPurchase]);

  async function install() {
    if (busy || !isIPhone) return;
    setBusy(true); setError('');
    try {
      await installPurchaseShortcut();
      // Sharing can also be canceled. The next step asks whether it was added,
      // and keeps the install button available; there is no "installed" flag.
      connectCard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the shortcut file. Try again.');
    } finally { setBusy(false); }
  }

  async function openAutomation() {
    if (busy || !isIPhone) return;
    setBusy(true); setError('');
    const pending: Handoff = { opened: false, leftApp: false, returned: false };
    handoff.current = pending;
    try {
      await Linking.openURL(automationSetupURL(unifiedAutomations));
      pending.opened = true;
      if (pending.returned) {
        handoff.current = null;
        awaitPurchase();
      }
    } catch {
      handoff.current = null;
      setError('Could not open Shortcuts. Install Apple’s Shortcuts app, then try again.');
    } finally { setBusy(false); }
  }

  function startAgain() {
    handoff.current = null;
    setError(''); setShowHelp(false); restart();
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>PURCHASE LOGGING</Text>
      <Text style={styles.title}>Connect Apple Pay</Text>
      <Text style={styles.body}>Add our shortcut, connect your card, then your supported Wallet taps can update your goal automatically.</Text>
      {!isIPhone && <Text style={styles.notice}>Set this up in GasFinder on your iPhone. You can read the steps here; manual logging is available in Edit goal.</Text>}
      {!hydrated ? <Text style={styles.hint}>Loading your setup…</Text> : <>
        <View accessibilityLabel={`Setup step ${stepNumber} of 3`} style={styles.progress}>
          {['Add shortcut', 'Connect card', 'Check logging'].map((label, index) => <View key={label} style={styles.progressItem}>
            <View style={[styles.progressLine, index + 1 <= stepNumber && styles.progressActive]} />
            <Text style={[styles.progressText, index + 1 === stepNumber && styles.progressSelected]}>{label}</Text>
          </View>)}
        </View>
        {stage === 'install' && <View style={styles.card}>
          <Text style={styles.section}>1. Add the shortcut</Text>
          <Text style={styles.body}>The purchase logging actions are already built. In the sheet that opens:</Text>
          <TapPath labels={['Shortcuts', 'Add Shortcut']} />
          <Button label={busy ? 'Opening…' : 'Add shortcut'} onPress={install} disabled={!isIPhone || busy} />
          <Text style={styles.hint}>Then come back here. We’ll continue with your card.</Text>
          <Button label="Already added it? Continue →" secondary onPress={() => { setError(''); connectCard(); }} disabled={busy} />
        </View>}
        {stage === 'automation' && <View style={styles.card}>
          <Text style={styles.section}>2. Connect your card</Text>
          <Text style={styles.body}>If you tapped Add Shortcut, use the button below. Apple requires you to choose your Wallet card and save the automation.</Text>
          <View style={styles.choices}>
            {[{ value: true, label: 'iOS 27+' }, { value: false, label: 'iOS 26 or earlier' }].map(({ value, label }) =>
              <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: unifiedAutomations === value }}
                onPress={() => setUnifiedAutomations(value)} style={[styles.choice, unifiedAutomations === value && styles.choiceSelected]}>
                <Text style={[styles.choiceText, unifiedAutomations === value && styles.choiceSelectedText]}>{label}</Text>
              </Pressable>)}
          </View>
          <Button label={busy ? 'Opening…' : unifiedAutomations ? 'Set up automation ↗' : 'Open Shortcuts to set up ↗'} onPress={openAutomation} disabled={!isIPhone || busy} />
          <Text style={styles.hint}>Follow these taps in Shortcuts, then return here after saving. We’ll check your first purchase.</Text>
          <View style={styles.instruction}>
            <Text style={styles.subheading}>Add the Transaction trigger</Text>
            <TapPath labels={unifiedAutomations ? ['Edit', 'Automation', 'Transaction'] : ['Automation', '+', 'Transaction']} />
            <Text style={styles.hint}>{unifiedAutomations ? `The button opens “${PURCHASE_SHORTCUT_NAME}” directly.` : 'The button opens Shortcuts. Tap the Automation tab at the bottom, then + at the top right (or New Automation). Search for Transaction.'}</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.subheading}>Pick the card you pay with</Text>
            <TapPath labels={['When I tap', 'Your USD card']} />
            <Text style={styles.hint}>{unifiedAutomations ? 'Save the Transaction trigger. Enable automatic running if Shortcuts asks.' : `Choose Run Immediately, then Next. Under My Shortcuts, select “${PURCHASE_SHORTCUT_NAME}”. The ready-made shortcut handles the purchase details.`}</Text>
          </View>
          {unifiedAutomations && <View style={styles.instruction}>
            <Text style={styles.subheading}>Allow running while locked</Text>
            <TapPath labels={['Edit', 'ⓘ', 'Privacy']} />
            <Text style={styles.hint}>Turn on Allow Running When Locked. Leave the logging actions as they are.</Text>
          </View>}
          <Button label="I saved the automation →" secondary onPress={() => { handoff.current = null; setError(''); awaitPurchase(); }} disabled={busy || !isIPhone} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={startAgain} style={styles.textButton}><Text style={styles.link}>Didn’t add the shortcut? Go back</Text></Pressable>
        </View>}
        {stage === 'verify' && <View style={styles.card}>
          <Text style={styles.section}>{received ? 'Purchase received' : '3. Check your first purchase'}</Text>
          {received ? <>
            <Text style={styles.received}>{formatMoney(received.amountCents)} · {received.title}</Text>
            <Text style={styles.body}>A purchase arrived from Shortcuts. Check that it matches your Wallet tap in Activity, along with any set-aside from your goal’s rule.</Text>
            <Button label="Open Goals & Activity" onPress={() => router.navigate('/investment')} />
          </> : <>
            <Text style={styles.body}>If you saved the Transaction automation, leave it enabled. After your next supported Apple Pay tap, the purchase will appear here and in Activity.</Text>
            <Text style={styles.waiting}>Waiting for a purchase from Shortcuts</Text>
            <Text style={styles.hint}>Coming back from Shortcuts does not confirm the automation is on. There’s no need to make a purchase just to test it.</Text>
          </>}
          <Button label={isIPhone ? 'Finish or change card setup ↗' : 'Review card setup'} secondary disabled={busy} onPress={() => {
            setError(''); connectCard();
            if (isIPhone) void openAutomation();
          }} />
          <Pressable accessibilityRole="button" onPress={startAgain} style={styles.textButton}><Text style={styles.link}>Add the shortcut again</Text></Pressable>
        </View>}
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHelp }} onPress={() => setShowHelp(!showHelp)} style={styles.helpButton}>
        <Text style={styles.link}>{showHelp ? 'Hide setup help −' : 'Need help? +'}</Text>
      </Pressable>
      {showHelp && <View style={styles.card}>
        <Text style={styles.subheading}>Shortcuts isn’t in the share sheet</Text>
        <Text style={styles.body}>Choose Save to Files. Open Files, tap “GasFinder Log Purchase.shortcut”, then Add Shortcut. Return to GasFinder and tap Already added it.</Text>
        <Text style={styles.subheading}>The shortcut can’t be found</Text>
        <Text style={styles.body}>Add it again and keep the name “GasFinder Log Purchase”. If asked about an existing copy, replace that copy. Opening Shortcuts successfully does not confirm the shortcut exists.</Text>
        <Text style={styles.subheading}>I added it but no purchase arrives</Text>
        <Text style={styles.body}>Check that Transaction uses the card you tapped and is enabled for automatic running. On older iOS, if you created a Run Shortcut action, set its Input to Shortcut Input so it receives the transaction.</Text>
        <Text style={styles.body}>A Play button run without a Wallet transaction will not log a purchase. In an Expo development build, keep GasFinder and its dev server running while testing; an installed standalone build is needed to reliably open from a closed state.</Text>
        <Text style={styles.subheading}>Turn logging off</Text>
        <Text style={styles.body}>Disable the Transaction automation in Shortcuts. Starting this guide again does not disable or delete an existing automation.</Text>
      </View>}
      <Text style={styles.hint}>Selected Wallet taps only; online orders, cash and physical card swipes aren’t captured. USD only. Purchases stay on this device and no money moves.</Text>
    </FormScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  subheading: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  notice: { color: colors.inkSoft, backgroundColor: colors.paleGreen, padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 16, gap: 12 },
  button: { backgroundColor: colors.ink, borderRadius: 8, padding: 15, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  secondary: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1 },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  progress: { flexDirection: 'row', gap: 8 },
  progressItem: { flex: 1, gap: 6 },
  progressLine: { height: 4, backgroundColor: colors.line, borderRadius: 2 },
  progressActive: { backgroundColor: colors.accentDark },
  progressText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  progressSelected: { color: colors.ink, fontWeight: '800' },
  instruction: { borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12, gap: 8 },
  path: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pathPart: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { color: colors.muted, fontSize: 18 },
  tap: { color: colors.ink, backgroundColor: colors.paleGreen, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 8, fontSize: 12, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, padding: 11, minHeight: 44, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  choiceSelectedText: { color: colors.surface },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  helpButton: { minHeight: 44, justifyContent: 'center' },
  waiting: { color: colors.ink, backgroundColor: colors.paleGreen, padding: 12, borderRadius: 6, fontSize: 13, fontWeight: '700' },
  received: { color: colors.ink, fontSize: 23, fontWeight: '800' },
});
