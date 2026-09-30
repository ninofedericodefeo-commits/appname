export type Subscription = {
  id: string;
  name: string;
  amountCents: number;
  cadence: 'monthly' | 'yearly';
  day: number;
  month: number;
  active: boolean;
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
};

export function upcomingReminderGroups(subscriptions: Subscription[], now: Date): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  const horizon = addCalendarDays(now, 400).getTime();

  for (const subscription of subscriptions) {
    if (!subscription.active) continue;

    for (let offset = 0; offset < 14; offset += 1) {
      const year = now.getFullYear();
      const monthIndex = now.getMonth() + offset;
      if (subscription.cadence === 'yearly' && ((monthIndex % 12) + 12) % 12 !== subscription.month - 1) continue;

      const renewal = renewalInMonth(subscription, year, monthIndex);
      const renewalDate = localDateKey(renewal);
      const reviewDay = addCalendarDays(renewal, -1);
      const at = new Date(reviewDay.getFullYear(), reviewDay.getMonth(), reviewDay.getDate(), 9);
      if (at.getTime() <= now.getTime() || at.getTime() > horizon) continue;
      if (subscription.lastReview?.renewalDate === renewalDate) continue;

      const key = localDateKey(reviewDay);
      const group = groups.get(key) ?? { at, renewalDate, names: [], totalCents: 0 };
      group.names.push(subscription.name);
      group.totalCents += subscription.amountCents;
      groups.set(key, group);
    }
  }

  return [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}
