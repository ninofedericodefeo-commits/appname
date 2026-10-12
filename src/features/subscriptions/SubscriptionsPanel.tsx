import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme';
import { usePocketStore } from '@/stores/pocketStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { suggestBankSubscriptions } from './bankSuggestions';
import type { BankSubscriptionSuggestion } from './bankSuggestions';
import { localDateKey, nextRenewal, subscriptionsToReviewTomorrow } from './logic';
import type { Subscription } from './logic';
import CancelSubscriptionButton from './CancelSubscriptionButton';
import SubscriptionButton from './SubscriptionButton';
import SubscriptionEditor from './SubscriptionEditor';

export default function SubscriptionsPanel() {
  const { subscriptions, setActive, review, removeSubscription, dismissedBankSuggestions, dismissBankSuggestion, restoreBankSuggestions } = useSubscriptionStore();
  const purchases = usePocketStore(state => state.purchases);
  const pocketReady = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const subsReady = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [today, setToday] = useState(() => new Date());
  const [editor, setEditor] = useState<{ subscription?: Subscription; suggestion?: BankSubscriptionSuggestion } | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLimit, setSuggestionLimit] = useState(5);
  const suggestions = useMemo(() => pocketReady && subsReady ? suggestBankSubscriptions(purchases, subscriptions, dismissedBankSuggestions, today) : [], [purchases, subscriptions, dismissedBankSuggestions, today, pocketReady, subsReady]);
  const due = subscriptionsToReviewTomorrow(subscriptions, today);
  const active = subscriptions.filter(subscription => subscription.active).sort((a, b) => nextRenewal(a, today).getTime() - nextRenewal(b, today).getTime());
  const inactive = subscriptions.filter(subscription => !subscription.active);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setToday(new Date()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);

  function card(subscription: Subscription) {
    const renewal = nextRenewal(subscription, today), renewalKey = localDateKey(renewal);
    const decision = subscription.lastReview?.renewalDate === renewalKey ? subscription.lastReview.decision : null;
    const needsReview = due.some(item => item.subscription.id === subscription.id);
    const managing = manageId === subscription.id;
    return <View key={subscription.id} style={styles.card}>
      <View style={styles.heading}><Text style={styles.name}>{subscription.name}</Text><Text style={styles.amount}>{formatMoney(subscription.amountCents)}</Text></View>
      <Text style={styles.meta}>{subscription.cadence === 'monthly' ? 'Monthly' : 'Yearly'} · {subscription.active ? `Renews ${renewal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Marked canceled'}</Text>
      {(subscription.isSample || subscription.associatedApp) && <View style={styles.badges}>{subscription.isSample && <Text style={styles.badge}>Sample</Text>}{subscription.associatedApp && <Text style={styles.appName}>{subscription.associatedApp.name}</Text>}</View>}
      {needsReview && <View style={styles.review}><Text style={styles.reviewText}>Renews tomorrow. Still worth it?</Text><SubscriptionButton label="Keep it" accessibilityLabel={`Keep ${subscription.name} for this renewal`} onPress={() => review(subscription.id, renewalKey, 'keep')} /></View>}
      {subscription.active && decision && <Text style={styles.note}>{decision === 'keep' ? 'Keeping it for this renewal.' : 'Planning to cancel. Complete cancellation with the provider to stop the charge.'}</Text>}
      <View style={styles.actions}>
        {subscription.active ? <CancelSubscriptionButton subscription={subscription} renewalDate={renewalKey} grow label={decision === 'plan-to-cancel' && subscription.associatedApp ? 'Open app to cancel' : 'Plan to cancel'} /> : <SubscriptionButton label="Reactivate" tone="primary" grow onPress={() => setActive(subscription.id, true)} />}
        <SubscriptionButton label={managing ? 'Done' : 'Manage'} accessibilityLabel={`${managing ? 'Close actions for' : 'Manage'} ${subscription.name}`} accessibilityState={{ expanded: managing }} onPress={() => { setManageId(managing ? null : subscription.id); setRemoveId(null); }} />
      </View>
      {managing && <View style={styles.manage}>
        <View style={styles.actions}><SubscriptionButton label="Edit" grow accessibilityLabel={`Edit ${subscription.name}`} onPress={() => setEditor({ subscription })} />{subscription.active && <SubscriptionButton label="I canceled it" grow onPress={() => setActive(subscription.id, false)} />}</View>
        {removeId === subscription.id ? <View style={styles.confirm}>
          <Text accessibilityLiveRegion="polite" style={styles.confirmText}>Delete {subscription.name}?</Text>
          <View style={styles.actions}><SubscriptionButton label="Keep it" grow accessibilityLabel={`Keep ${subscription.name}`} onPress={() => setRemoveId(null)} /><SubscriptionButton label="Delete" tone="danger" grow accessibilityLabel={`Confirm delete ${subscription.name}`} onPress={() => { removeSubscription(subscription.id); setRemoveId(null); setManageId(null); }} /></View>
        </View> : <SubscriptionButton label="Delete subscription" tone="danger" accessibilityLabel={`Delete ${subscription.name}`} onPress={() => setRemoveId(subscription.id)} />}
      </View>}
    </View>;
  }

  return <View style={styles.content}>
    <View><Text style={styles.title}>Subscriptions</Text><Text style={styles.intro}>Your renewals, all in one place.</Text></View>
    <View style={styles.heading}><Text style={styles.sectionTitle}>Upcoming · {active.length}</Text><SubscriptionButton label="Add" accessibilityLabel="Add subscription" tone="primary" disabled={!subsReady} onPress={() => setEditor({})} /></View>
    {!!due.length && <Text style={styles.reviewSummary}>{due.length} renewing tomorrow · {formatMoney(due.reduce((sum, item) => sum + item.subscription.amountCents, 0))} total</Text>}
    {!active.length && <View style={styles.card}><Text style={styles.name}>No upcoming subscriptions</Text><Text style={styles.note}>Add one to keep track of its price and next renewal.</Text></View>}
    {active.map(card)}
    {!!inactive.length && <><Text style={styles.sectionTitle}>Canceled · {inactive.length}</Text>{inactive.map(card)}</>}
    <View style={styles.bankSection}>
      <View style={styles.heading}><Text style={styles.sectionTitle}>From bank history · {suggestions.length}</Text><SubscriptionButton label={showSuggestions ? 'Hide' : 'Review'} accessibilityLabel="Review bank subscription suggestions" accessibilityState={{ expanded: showSuggestions }} onPress={() => setShowSuggestions(!showSuggestions)} /></View>
      {showSuggestions && <View style={styles.suggestions}>
        <Text style={styles.note}>Review recurring charges before adding them.</Text>
        <SubscriptionButton label="Import bank PDF or CSV" onPress={() => router.push('/bank-import')} />
        {suggestions.slice(0, suggestionLimit).map(suggestion => <View key={suggestion.key} style={styles.suggestion}>
          <View style={styles.heading}><Text style={styles.name}>{suggestion.name}</Text><Text style={styles.amount}>{formatMoney(suggestion.amountCents)}</Text></View>
          <Text style={styles.meta}>{suggestion.confidence === 'repeated' ? `Repeats ${suggestion.cadence}` : 'Possible subscription · one charge'}</Text>
          <Text style={styles.note}>{suggestion.evidence.map(charge => `${new Date(charge.date).toLocaleDateString()}: ${formatMoney(charge.amountCents)}`).join(' · ')}</Text>
          <View style={styles.actions}><SubscriptionButton label="Review & add" accessibilityLabel={`Review ${suggestion.name} suggestion`} tone="primary" grow onPress={() => setEditor({ suggestion })} /><SubscriptionButton label="Dismiss" accessibilityLabel={`Dismiss ${suggestion.name} suggestion`} grow onPress={() => dismissBankSuggestion(suggestion.key)} /></View>
        </View>)}
        {!suggestions.length && <Text style={styles.note}>No new suggestions yet. Import a statement to look for recurring charges.</Text>}
        {suggestionLimit < suggestions.length && <SubscriptionButton label="Show more" onPress={() => setSuggestionLimit(suggestionLimit + 5)} />}
        {!!dismissedBankSuggestions.length && <SubscriptionButton label="Restore dismissed suggestions" onPress={restoreBankSuggestions} />}
      </View>}
    </View>
    <Text style={styles.footer}>Saved on this device. Planning to cancel does not stop charges.</Text>
    {editor && <SubscriptionEditor subscription={editor.subscription} suggestion={editor.suggestion} onClose={() => setEditor(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: 14 }, title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 }, intro: { color: colors.muted, fontSize: 15, marginTop: 5 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800', flex: 1 }, amount: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { color: colors.muted, fontSize: 13 }, badges: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, badge: { color: colors.inkSoft, fontSize: 11, fontWeight: '700', backgroundColor: colors.paleGreen, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, appName: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  manage: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, gap: 10, marginTop: 4 }, confirm: { backgroundColor: colors.dangerPale, borderRadius: 10, padding: 12, gap: 8 }, confirmText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  review: { backgroundColor: colors.paleOrange, borderRadius: 10, padding: 12, gap: 10, marginVertical: 4 }, reviewText: { color: colors.accentDark, fontSize: 13, fontWeight: '700' }, reviewSummary: { color: colors.accentDark, fontSize: 13, lineHeight: 19 },
  bankSection: { marginTop: 10, borderTopWidth: 1, borderColor: colors.line, paddingTop: 20 }, suggestions: { gap: 14, marginTop: 14 }, suggestion: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
