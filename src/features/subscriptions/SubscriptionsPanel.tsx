import SubscriptionCosts from './SubscriptionCosts';
import SubscriptionCalendar from './SubscriptionCalendar';
import CancellationControls from './CancellationControls';
import { subscriptionScheduleAlerts } from './scheduleEvidence';
import { billingChannels } from './billing';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme';
import { usePocketStore } from '@/stores/pocketStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { bankMerchant, suggestBankSubscriptions } from './bankSuggestions';
import type { BankSubscriptionSuggestion } from './bankSuggestions';
import { localDateKey, nextRenewal, subscriptionsToReviewTomorrow } from './logic';
import type { Subscription } from './logic';
import CancelSubscriptionButton from './CancelSubscriptionButton';
import SubscriptionButton from './SubscriptionButton';
import SubscriptionEditor from './SubscriptionEditor';
import { subscriptionBankAlerts, subscriptionBankEvidence, subscriptionRefunds } from './bankEvidence';
import { subscriptionsForMode, renewalSnoozeUntil } from './reviewPreferences';

export default function SubscriptionsPanel() {
  const { subscriptions, setActive, review, removeSubscription, dismissedBankSuggestions, dismissBankSuggestion, restoreBankSuggestions, dismissedBankAlerts, dismissBankAlert, sampleMode, reviewSnoozes, snoozeReviews, resumeReviews } = useSubscriptionStore();
  const { purchases, accountTransactions, transactionDirections, linkedBankAccount, transactionDetails } = usePocketStore();
  const evidence = useMemo(() => subscriptionBankEvidence(accountTransactions, purchases, transactionDirections, linkedBankAccount, transactionDetails), [accountTransactions, purchases, transactionDirections, linkedBankAccount, transactionDetails]);
  const refunds = useMemo(() => subscriptionRefunds(accountTransactions, purchases, transactionDirections, linkedBankAccount, transactionDetails), [accountTransactions, purchases, transactionDirections, linkedBankAccount, transactionDetails]);
  const scheduleAlerts = useMemo(() => subscriptionScheduleAlerts(evidence, subscriptions, dismissedBankAlerts), [evidence, subscriptions, dismissedBankAlerts]);
  const alerts = useMemo(() => subscriptionBankAlerts(evidence, subscriptions, dismissedBankAlerts), [evidence, subscriptions, dismissedBankAlerts]);
  const pocketReady = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const subsReady = useSyncExternalStore(useSubscriptionStore.persist.onFinishHydration, useSubscriptionStore.persist.hasHydrated, () => false);
  const [today, setToday] = useState(() => new Date());
  const [editor, setEditor] = useState<{ subscription?: Subscription; suggestion?: BankSubscriptionSuggestion } | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<'list' | 'calendar'>('list');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLimit, setSuggestionLimit] = useState(5);
  const suggestions = useMemo(() => pocketReady && subsReady ? suggestBankSubscriptions(evidence, subscriptions.filter(item => !item.isSample), dismissedBankSuggestions, today) : [], [evidence, subscriptions, dismissedBankSuggestions, today, pocketReady, subsReady]);
  const visibleSubscriptions = subscriptionsForMode(subscriptions, sampleMode);
  const due = subscriptionsToReviewTomorrow(visibleSubscriptions, today);
  const snoozed = due.filter(({ subscription, renewal }) => renewalSnoozeUntil(subscription, renewal, reviewSnoozes, today));
  const nextSnoozeEnd = snoozed.length ? new Date(Math.min(...snoozed.map(({ subscription, renewal }) => Date.parse(renewalSnoozeUntil(subscription, renewal, reviewSnoozes, today)!)))) : null;
  const snoozeEndLabel = nextSnoozeEnd?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const active = visibleSubscriptions.filter(subscription => subscription.active).sort((a, b) => nextRenewal(a, today).getTime() - nextRenewal(b, today).getTime());
  const inactive = visibleSubscriptions.filter(subscription => !subscription.active);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setToday(new Date()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);

  function card(subscription: Subscription) {
    const renewal = nextRenewal(subscription, today), renewalKey = localDateKey(renewal);
    const decision = subscription.cancelBy ? 'plan-to-cancel' : subscription.lastReview?.renewalDate === renewalKey ? subscription.lastReview.decision : null;
    const needsReview = due.some(item => item.subscription.id === subscription.id);
    const managing = manageId === subscription.id;
    return <View key={subscription.id} style={styles.card}>
      <View style={styles.heading}><Text style={styles.name}>{subscription.name}</Text><Text style={styles.amount}>{formatMoney(subscription.amountCents)}</Text></View>
      <Text style={styles.meta}>{subscription.cadence === 'monthly' ? 'Monthly' : 'Yearly'} · {subscription.active ? `Renews ${renewal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Marked canceled'}</Text>
      {(subscription.billingChannel || subscription.category || subscription.trialEndsOn) && <Text style={styles.note}>{billingChannels.find(channel => channel.id === subscription.billingChannel)?.label ?? 'Billing not confirmed'}{subscription.category ? ` · ${subscription.category}` : ''}{subscription.trialEndsOn && subscription.trialEndsOn >= localDateKey(today) ? ` · Trial ends ${subscription.trialEndsOn}` : ''}</Text>}
      {(subscription.isSample || subscription.associatedApp) && <View style={styles.badges}>{subscription.isSample && <Text style={styles.badge}>Sample</Text>}{subscription.associatedApp && <Text style={styles.appName}>{subscription.associatedApp.name}</Text>}</View>}
      {needsReview && <View style={styles.review}><Text style={styles.reviewText}>Renews tomorrow. Still worth it?</Text><SubscriptionButton label="Keep it" accessibilityLabel={`Keep ${subscription.name} for this renewal`} onPress={() => review(subscription.id, renewalKey, 'keep')} /></View>}
      {subscription.active && decision && <Text style={styles.note}>{decision === 'keep' ? 'Keeping it for this renewal.' : 'Planning to cancel. Complete cancellation with the provider to stop the charge.'}</Text>}
      <View style={styles.actions}>
        {subscription.active ? <CancelSubscriptionButton subscription={subscription} renewalDate={renewalKey} grow label={decision === 'plan-to-cancel' ? 'Open cancellation again' : 'Plan to cancel'} /> : <SubscriptionButton label="Reactivate" tone="primary" grow onPress={() => setActive(subscription.id, true)} />}
        <SubscriptionButton label={managing ? 'Done' : 'Manage'} accessibilityLabel={`${managing ? 'Close actions for' : 'Manage'} ${subscription.name}`} accessibilityState={{ expanded: managing }} onPress={() => { setManageId(managing ? null : subscription.id); setRemoveId(null); }} />
      </View>
      <CancellationControls subscription={subscription} managing={managing} />
      {managing && <View style={styles.manage}>
        <View style={styles.actions}><SubscriptionButton label="Edit" grow accessibilityLabel={`Edit ${subscription.name}`} onPress={() => setEditor({ subscription })} /></View>
        {removeId === subscription.id ? <View style={styles.confirm}>
          <Text accessibilityLiveRegion="polite" style={styles.confirmText}>Delete {subscription.name}?</Text>
          <View style={styles.actions}><SubscriptionButton label="Keep it" grow accessibilityLabel={`Keep ${subscription.name}`} onPress={() => setRemoveId(null)} /><SubscriptionButton label="Delete" tone="danger" grow accessibilityLabel={`Confirm delete ${subscription.name}`} onPress={() => { removeSubscription(subscription.id); setRemoveId(null); setManageId(null); }} /></View>
        </View> : <SubscriptionButton label="Delete subscription" tone="danger" accessibilityLabel={`Delete ${subscription.name}`} onPress={() => setRemoveId(subscription.id)} />}
      </View>}
    </View>;
  }

  return <View style={styles.content}>
    <View><Text style={styles.title}>Subscriptions</Text><Text style={styles.intro}>Your renewals, all in one place.</Text></View>
    {sampleMode && <View style={styles.review}><Text style={styles.reviewText}>Test subscriptions are on</Text><Text style={styles.note}>Sample renewals appear here for testing. Phone reminders only include your real subscriptions.</Text><SubscriptionButton label="Manage test mode in Settings" onPress={() => router.push('/settings')} /></View>}
    <SubscriptionCosts subscriptions={subscriptions} today={today} />
    {!!due.length && <View style={styles.card}><Text style={styles.sectionTitle}>{due.length} renewal{due.length === 1 ? '' : 's'} tomorrow · {formatMoney(due.reduce((sum, item) => sum + item.subscription.amountCents, 0))}</Text><Text style={styles.note}>{snoozed.length ? `${snoozed.length} review${snoozed.length === 1 ? '' : 's'} snoozed. Next returns ${snoozeEndLabel}. You can still review the cards below.` : 'Review the cards below, or snooze the reminder banner.'}</Text><View style={styles.actions}><SubscriptionButton label="Later · 2h" grow onPress={() => snoozeReviews('two-hours')} /><SubscriptionButton label="Hide for today" grow onPress={() => snoozeReviews('today')} /></View>{!!snoozed.length && <SubscriptionButton label="Show renewal banner again" onPress={resumeReviews} />}</View>}
    {pocketReady && subsReady && alerts.length > 0 && <><Text style={styles.sectionTitle}>Updates from your bank · {alerts.length}</Text>{alerts.map(alert => <View key={alert.id} style={styles.card}>
      <Text style={styles.name}>{alert.subscription.name}</Text><Text style={styles.note}>{alert.kind === 'price-change' ? `A new posted charge was ${formatMoney(alert.charge.amountCents)}. Your saved price is ${formatMoney(alert.subscription.amountCents)}.` : `A ${formatMoney(alert.charge.amountCents)} charge posted after you marked this subscription canceled.`} Posted {new Date(alert.charge.purchasedAt).toLocaleDateString()}.</Text>
      {refunds.filter(refund => refund.merchantKey === (alert.subscription.bankMerchantKey ?? bankMerchant(alert.subscription.name).key) && Date.parse(refund.date) >= Date.parse(alert.charge.purchasedAt) && Date.parse(refund.date) - Date.parse(alert.charge.purchasedAt) <= 90 * 86400000).map(refund => <Text key={refund.id} style={styles.note}>Possible refund/reversal: {formatMoney(refund.amountCents)} posted {new Date(refund.date).toLocaleDateString()}. Check the statement before dismissing this alert.</Text>)}
      <View style={styles.actions}><SubscriptionButton label={alert.kind === 'price-change' ? 'Review price' : 'Review subscription'} tone="primary" grow onPress={() => setEditor({ subscription: alert.kind === 'price-change' ? { ...alert.subscription, amountCents: alert.charge.amountCents } : alert.subscription })} /><SubscriptionButton label="Dismiss" grow onPress={() => dismissBankAlert(alert.id)} /></View>
    </View>)}</>}
    {scheduleAlerts.map(alert => <View key={alert.id} style={styles.card}><Text style={styles.name}>{alert.subscription.name} · billing schedule review</Text><Text style={styles.note}>Three posted charges suggest {alert.cadence} billing near day {alert.day}. Your saved schedule is {alert.subscription.cadence}, day {alert.subscription.day}. Posting delays can differ from the actual billing date.</Text><Text style={styles.note}>{alert.evidence.map(row => new Date(row.purchasedAt).toLocaleDateString()).join(' · ')}</Text><View style={styles.actions}><SubscriptionButton label="Review suggested date" tone="primary" grow onPress={() => setEditor({ subscription: { ...alert.subscription, cadence: alert.cadence, day: alert.day, month: alert.month } })} /><SubscriptionButton label="Keep my schedule" grow onPress={() => dismissBankAlert(alert.id)} /></View></View>)}
    <View style={styles.heading}><Text style={styles.sectionTitle}>Upcoming · {active.length}</Text><SubscriptionButton label="Add" accessibilityLabel="Add subscription" tone="primary" disabled={!subsReady} onPress={() => setEditor({})} /></View>
    {!active.length && <View style={styles.card}><Text style={styles.name}>No upcoming subscriptions</Text><Text style={styles.note}>Add one to keep track of its price and next renewal.</Text></View>}
    <View style={styles.actions}><SubscriptionButton label="List" grow tone={scheduleView === 'list' ? 'primary' : 'secondary'} accessibilityState={{ selected: scheduleView === 'list' }} onPress={() => setScheduleView('list')} /><SubscriptionButton label="Calendar" grow tone={scheduleView === 'calendar' ? 'primary' : 'secondary'} accessibilityState={{ selected: scheduleView === 'calendar' }} onPress={() => setScheduleView('calendar')} /></View>
    {scheduleView === 'calendar' && active.some(item => item.cancelBy) && <Text style={styles.note}>Switch to List to finish cancellation follow-ups.</Text>}
    {scheduleView === 'calendar' ? <SubscriptionCalendar subscriptions={visibleSubscriptions} today={today} includeSamples={sampleMode} onEdit={subscription => setEditor({ subscription })} /> : active.map(card)}
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
  review: { backgroundColor: colors.paleOrange, borderRadius: 10, padding: 12, gap: 10, marginVertical: 4 }, reviewText: { color: colors.accentDark, fontSize: 13, fontWeight: '700' },
  bankSection: { marginTop: 10, borderTopWidth: 1, borderColor: colors.line, paddingTop: 20 }, suggestions: { gap: 14, marginTop: 14 }, suggestion: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
