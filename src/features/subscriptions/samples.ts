import { addCalendarDays } from './logic.ts';
import type { Subscription } from './logic.ts';

// Invented services/prices exercise tomorrow's review, a later monthly renewal and a yearly renewal.
export function sampleSubscriptions(now = new Date()): Subscription[] {
  return [
    { id: 'sample-music', name: 'Music Plus', amountCents: 799, cadence: 'monthly' as const, offset: 1 },
    { id: 'sample-movies', name: 'Movie Night', amountCents: 1299, cadence: 'monthly' as const, offset: 3 },
    { id: 'sample-cloud', name: 'Cloud Space', amountCents: 4999, cadence: 'yearly' as const, offset: 7 },
  ].map(({ offset, ...subscription }) => {
    const date = addCalendarDays(now, offset);
    return { ...subscription, active: true, isSample: true, day: date.getDate(), month: date.getMonth() + 1 };
  });
}

export function replaceSampleSubscriptions(subscriptions: Subscription[], now = new Date()) {
  return [...subscriptions.filter(subscription => !subscription.isSample), ...sampleSubscriptions(now)];
}
