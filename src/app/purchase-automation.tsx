import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { installPurchaseShortcut } from '@/features/goals/installShortcut';
import { colors } from '@/theme';

const modernShortcuts = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 27;

export default function PurchaseAutomationScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isIPhone = Platform.OS === 'ios';

  async function install() {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await installPurchaseShortcut();
      setMessage('Once you have added the shortcut, connect your card below. Returning here does not confirm it is installed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the shortcut file. Try again.');
    } finally { setBusy(false); }
  }

  async function openShortcuts() {
    setError('');
    try { await Linking.openURL('shortcuts://'); }
    catch { setError('Could not open Shortcuts. Install Apple’s Shortcuts app, then try again.'); }
  }

  const steps = modernShortcuts ? [
    'Open “GasFinder Log Purchase” in Shortcuts. Tap Edit, then Automation and choose Transaction.',
    'Choose the Wallet card you use for USD purchases. Set it to run automatically; in Privacy, allow running when locked if you want automatic logging.',
    'Make a supported Apple Pay tap, then check Activity in GasFinder. The amount and merchant come from the transaction.',
  ] : [
    'In Shortcuts, open Automation → + → Transaction. Choose the Wallet card you use for USD purchases and select Run Immediately.',
    'Choose “GasFinder Log Purchase”. If you use a Run Shortcut action, pass the transaction as Shortcut Input. The logging actions are already built.',
    'Make a supported Apple Pay tap, then check Activity in GasFinder. The amount and merchant come from the transaction.',
  ];

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><FormScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>PURCHASE LOGGING</Text>
    <Text style={styles.title}>Connect Apple Pay</Text>
    <Text style={styles.body}>Install the ready-made shortcut, then choose your card. Each supported tap logs a purchase and applies your goal’s rule to the pocket estimate.</Text>
    <View style={styles.card}>
      <Text style={styles.section}>1. Add the logging shortcut</Text>
      <Text style={styles.body}>The amount, merchant and logging actions are already filled in.</Text>
      <Pressable accessibilityRole="button" disabled={!isIPhone || busy} onPress={install} style={[styles.button, (!isIPhone || busy) && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'Opening…' : 'Add logging shortcut'}</Text></Pressable>
      <Text style={styles.hint}>{isIPhone ? 'Choose Shortcuts in the share sheet and tap Add Shortcut. If it is not listed, choose Save to Files, then tap the saved file to import it.' : 'Open this page in GasFinder on your iPhone to install. Manual logging remains available on this device.'}</Text>
      {message ? <Text style={styles.hint}>{message}</Text> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.section}>2. Choose your card</Text>
      <Text style={styles.body}>Apple requires this step in Shortcuts. GasFinder cannot select your Wallet card or enable its automation for you.</Text>
      {steps.map((step, index) => <View key={step} style={styles.step}><Text style={styles.number}>{index + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
      {isIPhone && <Pressable accessibilityRole="button" onPress={openShortcuts} style={[styles.button, styles.secondary]}><Text style={styles.secondaryText}>Open Shortcuts ↗</Text></Pressable>}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Text style={styles.hint}>Selected Wallet card taps only. Online orders, cash and physical card swipes are not automatically captured. Use USD purchases; other currencies are not converted. Purchases stay on this device and no money moves.</Text>
    <Text style={styles.hint}>For an Expo development build, open GasFinder before testing. A standalone installed build is needed to reliably launch the app from a closed state.</Text>
  </FormScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 16, gap: 12 },
  button: { backgroundColor: colors.ink, borderRadius: 8, padding: 15, alignItems: 'center', minHeight: 48 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  secondary: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1 },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  step: { flexDirection: 'row', gap: 12 },
  number: { color: colors.accentDark, fontSize: 16, fontWeight: '800' },
  stepText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21 },
});
