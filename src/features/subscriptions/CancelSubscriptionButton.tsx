import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { create } from 'zustand';
import type { Subscription } from './logic';
import { openSubscriptionApp } from './providerApps';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { colors } from '@/theme';

const useCancellationNotice = create<{ message: string; setMessage: (message: string) => void }>(set => ({ message: '', setMessage: message => set({ message }) }));

export function SubscriptionCancellationNotice() {
  const { message, setMessage } = useCancellationNotice();
  if (!message) return null;
  return <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss subscription cancellation message" style={styles.dismiss} onPress={() => setMessage('')}><Text style={styles.label}>Dismiss</Text></Pressable></View>;
}

export default function CancelSubscriptionButton({ subscription, renewalDate, label = 'Plan to cancel' }: { subscription: Subscription; renewalDate: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const opening = useRef(false);
  async function plan() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    useCancellationNotice.getState().setMessage('');
    try {
      // Record the intention even when the provider app isn't installed.
      useSubscriptionStore.getState().review(subscription.id, renewalDate, 'plan-to-cancel');
      const result = await openSubscriptionApp(subscription.associatedApp, Linking.openURL, Platform.OS);
      useCancellationNotice.getState().setMessage(result.message);
    } finally { opening.current = false; setBusy(false); }
  }
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${subscription.name}`} disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void plan()}><Text style={styles.label}>{busy ? 'Opening…' : label}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { flexShrink: 1, maxWidth: '100%' }, button: { minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, justifyContent: 'center', alignItems: 'center' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' }, disabled: { opacity: .5 }, message: { color: colors.ink, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  notice: { position: 'absolute', bottom: 88, left: 12, right: 12, padding: 12, backgroundColor: colors.paleGreen, borderWidth: 1, borderColor: colors.line, borderRadius: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }, dismiss: { minHeight: 44, justifyContent: 'center' },
});
