import { useThemeRevision } from '@/theme';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { create } from 'zustand';
import type { Subscription } from './logic';
import { openCancellationDestination } from './billing';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import SubscriptionButton from './SubscriptionButton';
import { NoticeCard } from '@/features/notices/NoticeCard';
import { useNoticeTimeout } from '@/features/notices/useNoticeTimeout';

const useCancellationNotice = create<{ message: string; revision: number; persistent: boolean; setMessage: (message: string, persistent?: boolean) => void }>(set => ({ message: '', revision: 0, persistent: false, setMessage: (message, persistent = false) => set(state => ({ message, persistent, revision: state.revision + 1 })) }));

export function SubscriptionCancellationNotice() {
  useThemeRevision();
  const { message, revision, persistent, setMessage } = useCancellationNotice();
  useNoticeTimeout(message ? revision : 0, () => setMessage(''), 3000, !persistent);
  if (!message) return null;
  return <NoticeCard message={message} warning={persistent} actionLabel="Dismiss subscription cancellation message" onAction={() => setMessage('')} />;
}

export default function CancelSubscriptionButton({ subscription, renewalDate, label = 'Plan to cancel', grow = false }: { subscription: Subscription; renewalDate: string; label?: string; grow?: boolean }) {
  useThemeRevision();
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
      const result = await openCancellationDestination(subscription, Linking.openURL, Platform.OS);
      useCancellationNotice.getState().setMessage(result.message, !result.opened);
    } catch { useCancellationNotice.getState().setMessage('Could not save this cancellation plan. Try again.', true); } finally { opening.current = false; setBusy(false); }
  }
  return <SubscriptionButton label={busy ? 'Opening…' : label} accessibilityLabel={`${label} ${subscription.name}`}
    tone="primary" disabled={busy} grow={grow} onPress={() => void plan()} />;
}
