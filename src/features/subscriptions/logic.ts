import type { BillingChannel } from './billing.ts';
import type { SubscriptionApp } from './providerApps.ts';

export type Subscription = {
  id: string;
  name: string;
  amountCents: number;
  cadence: 'monthly' | 'yearly';
  day: number;
  month: number;
  active: boolean;
  isSample?: boolean;
  associatedApp?: SubscriptionApp;
  bankMerchantKey?: string;
  createdAt?: string;
  amountUpdatedAt?: string;
  canceledAt?: string;
  billingChannel?: BillingChannel;
  category?: string;
  trialEndsOn?: string;
  cancelBy?: string;
  scheduleUpdatedAt?: string;
  cancellationHistory?: { canceledAt: string; reactivatedAt?: string }[];
  lastReview?: {
    renewalDate: string;
    decision: 'keep' | 'plan-to-cancel';
    decidedAt: string;
  };
};

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

function renewalInMonth(subscription: Subscription, year: number, monthIndex: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(subscription.day, lastDay), 12);
}

export function nextRenewal(subscription: Subscription, from: Date): Date {
  const today = localDateKey(from);
  const trial = dateFromKey(subscription.trialEndsOn ?? '');
  if (trial && localDateKey(trial) >= today) return trial;

  if (subscription.cadence === 'yearly') {
    const monthIndex = subscription.month - 1;
    let renewal = renewalInMonth(subscription, from.getFullYear(), monthIndex);
    if (localDateKey(renewal) < today) {
      renewal = renewalInMonth(subscription, from.getFullYear() + 1, monthIndex);
    }
    return renewal;
  }

  let renewal = renewalInMonth(subscription, from.getFullYear(), from.getMonth());
  if (localDateKey(renewal) < today) {
    renewal = renewalInMonth(subscription, from.getFullYear(), from.getMonth() + 1);
  }
  return renewal;
}

export function subscriptionsToReviewTomorrow(subscriptions: Subscription[], today: Date) {
  const tomorrow = localDateKey(addCalendarDays(today, 1));
  return subscriptions
    .filter((subscription) => subscription.active)
    .map((subscription) => ({ subscription, renewal: nextRenewal(subscription, today) }))
    .filter(({ subscription, renewal }) =>
      localDateKey(renewal) === tomorrow && subscription.lastReview?.renewalDate !== tomorrow,
    );
}

export type ReminderGroup = {
  at: Date;
  renewalDate: string;
  names: string[];
  totalCents: number;
  cancelNames?: string[];
};

export function dateFromKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number), date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === key ? date : null;
}
export function renewalsBetween(subscription: Subscription, from: Date, through: Date): Date[] {
  const first = localDateKey(from), end = localDateKey(through), trial = dateFromKey(subscription.trialEndsOn ?? '');
  const dates = new Map<string, Date>();
  if (trial && localDateKey(trial) >= first && localDateKey(trial) < end) dates.set(localDateKey(trial), trial);
  // Calendar-month iteration preserves Jan 31 → Feb 28 → Mar 31 without drifting.
  for (let offset = 0; offset < 15; offset++) {
    const month = new Date(from.getFullYear(), from.getMonth() + offset, 1, 12);
    if (localDateKey(month) >= end && offset > 0) break;
    if (subscription.cadence === 'yearly' && month.getMonth() + 1 !== subscription.month) continue;
    const renewal = renewalInMonth(subscription, month.getFullYear(), month.getMonth()), key = localDateKey(renewal);
    if (key >= first && key < end && (!trial || key > localDateKey(trial))) dates.set(key, renewal);
  }
  return [...dates.values()].sort((a, b) => a.getTime() - b.getTime());
}
export function upcomingCharges(subscriptions: Subscription[], from: Date, days = 30, includeSamples = false) {
  if (!Number.isInteger(days) || days < 1 || days > 400) throw new Error('Choose a forecast from 1 to 400 days.');
  const through = addCalendarDays(from, days);
  return subscriptions.filter(item => item.active && (includeSamples || !item.isSample)).flatMap(subscription => renewalsBetween(subscription, from, through).map(date => ({ subscription, date, dateKey: localDateKey(date), amountCents: subscription.amountCents }))).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.subscription.name.localeCompare(b.subscription.name));
}
export function subscriptionCosts(subscriptions: Subscription[], now: Date) {
  const real = subscriptions.filter(item => item.active && !item.isSample);
  const annualCents = real.reduce((sum, item) => sum + item.amountCents * (item.cadence === 'monthly' ? 12 : 1), 0);
  const next30 = upcomingCharges(real, now, 30), next7End = localDateKey(addCalendarDays(now, 7));
  return { annualCents, monthlyEquivalentCents: Math.round(annualCents / 12), next30Cents: next30.reduce((sum, item) => sum + item.amountCents, 0), next7Cents: next30.filter(item => item.dateKey < next7End).reduce((sum, item) => sum + item.amountCents, 0), activeCount: real.length };
}

export function upcomingReminderGroups(subscriptions: Subscription[], now: Date): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  const members = new Map<string, Set<string>>();
  function add(subscription: Subscription, date: Date, renewalDate: string, cancellation: boolean) {
    const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
    if (at.getTime() <= now.getTime() || at.getTime() > addCalendarDays(now, 400).getTime()) return;
    const key = localDateKey(date), group = groups.get(key) ?? { at, renewalDate, names: [], totalCents: 0, cancelNames: [] };
    const ids = members.get(key) ?? new Set<string>();
    if (!ids.has(subscription.id)) { group.names.push(subscription.name); group.totalCents += subscription.amountCents; ids.add(subscription.id); members.set(key, ids); }
    if (cancellation) group.cancelNames!.push(subscription.name);
    groups.set(key, group);
  }
  for (const { subscription, date, dateKey } of upcomingCharges(subscriptions, now, 400)) {
    if (subscription.lastReview?.renewalDate !== dateKey) add(subscription, addCalendarDays(date, -1), dateKey, false);
  }
  for (const subscription of subscriptions.filter(item => item.active && !item.isSample && item.cancelBy)) {
    const due = dateFromKey(subscription.cancelBy!); if (due) add(subscription, due, subscription.cancelBy!, true);
  }
  return [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}

export const subscriptionCategories = ['Entertainment', 'Music', 'Software', 'Cloud', 'Health', 'Other'] as const;
export function validateSubscription(input: Pick<Subscription, 'name' | 'amountCents' | 'cadence' | 'day' | 'month' | 'trialEndsOn' | 'billingChannel' | 'category'>) {
  if (!input.name.trim() || input.name.length > 80 || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 100_000_000) throw new Error('Enter a name and a valid renewal price.');
  if (!['monthly', 'yearly'].includes(input.cadence) || !Number.isInteger(input.day) || input.day < 1 || input.day > 31 || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new Error('Check the renewal date and cadence.');
  if (input.trialEndsOn && !dateFromKey(input.trialEndsOn)) throw new Error('Choose a valid trial end date.');
  if (input.billingChannel && !['unknown', 'apple', 'google', 'website', 'app'].includes(input.billingChannel)) throw new Error('Choose a billing channel.');
  if (input.category && !subscriptionCategories.includes(input.category as typeof subscriptionCategories[number])) throw new Error('Choose a subscription category.');
}

export function plannedCancellationDate(subscription: Pick<Subscription, 'cancelBy' | 'lastReview'>, today = new Date()) {
  if (subscription.cancelBy && dateFromKey(subscription.cancelBy)) return subscription.cancelBy;
  const renewal = dateFromKey(subscription.lastReview?.renewalDate ?? '');
  return [localDateKey(today), localDateKey(addCalendarDays(renewal ?? today, -1))].sort().at(-1)!;
}
export function migrateSubscriptionPlanning(subscription: Subscription, today = new Date()): Subscription {
  return { ...subscription,
    ...(subscription.active && subscription.lastReview?.decision === 'plan-to-cancel' ? { cancelBy: plannedCancellationDate(subscription, today) } : {}),
    ...(subscription.canceledAt && !subscription.cancellationHistory?.length ? { cancellationHistory: [{ canceledAt: subscription.canceledAt }] } : {}),
  };
}
