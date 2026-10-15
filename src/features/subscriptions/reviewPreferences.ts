import { localDateKey, subscriptionsToReviewTomorrow } from './logic.ts';
import type { Subscription } from './logic.ts';

export type RenewalSnoozes = Record<string, { until: string; fingerprint: string }>;
export const subscriptionsForMode = (subscriptions: Subscription[], sampleMode: boolean) => subscriptions.filter(item => sampleMode || !item.isSample);
export const renewalReviewKey = (id: string, renewal: Date) => JSON.stringify([id, localDateKey(renewal)]);
const fingerprint = (subscription: Subscription) => JSON.stringify([subscription.name, subscription.amountCents, subscription.cadence, subscription.day, subscription.month, subscription.trialEndsOn ?? null, !!subscription.isSample]);

export function renewalSnoozeUntil(subscription: Subscription, renewal: Date, snoozes: RenewalSnoozes, now: Date) {
  const entry = snoozes[renewalReviewKey(subscription.id, renewal)];
  return entry && entry.fingerprint === fingerprint(subscription) && Date.parse(entry.until) > now.getTime() ? entry.until : null;
}

export function pendingRenewalReviews(subscriptions: Subscription[], sampleMode: boolean, snoozes: RenewalSnoozes, now: Date) {
  return subscriptionsToReviewTomorrow(subscriptionsForMode(subscriptions, sampleMode), now)
    .filter(({ subscription, renewal }) => !renewalSnoozeUntil(subscription, renewal, snoozes, now));
}

export function snoozeRenewalReviews(subscriptions: Subscription[], sampleMode: boolean, previous: RenewalSnoozes, duration: 'two-hours' | 'today', now = new Date()): RenewalSnoozes {
  const until = duration === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : new Date(now.getTime() + 2 * 60 * 60_000);
  const next = Object.fromEntries(Object.entries(previous).filter(([, entry]) => Date.parse(entry.until) > now.getTime()));
  for (const { subscription, renewal } of subscriptionsToReviewTomorrow(subscriptionsForMode(subscriptions, sampleMode), now)) {
    next[renewalReviewKey(subscription.id, renewal)] = { until: until.toISOString(), fingerprint: fingerprint(subscription) };
  }
  return next;
}

export function clearSampleSnoozes(subscriptions: Subscription[], snoozes: RenewalSnoozes): RenewalSnoozes {
  const sampleIds = new Set(subscriptions.filter(item => item.isSample).map(item => item.id));
  return Object.fromEntries(Object.entries(snoozes).filter(([key]) => { try { return !sampleIds.has(JSON.parse(key)[0]); } catch { return false; } }));
}

export function migrateReviewPreferences(state: { subscriptions?: Subscription[]; sampleMode?: boolean; reviewSnoozes?: RenewalSnoozes }) {
  // Existing requested samples remain in test mode. Fresh installations start normal.
  return { sampleMode: state.sampleMode ?? !!state.subscriptions?.some(item => item.isSample), reviewSnoozes: state.reviewSnoozes ?? {} };
}
