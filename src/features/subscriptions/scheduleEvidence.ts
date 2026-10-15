import type { LoggedPurchase } from '../goals/logic.ts';
import { bankMerchant } from './bankSuggestions.ts';
import { localDateKey } from './logic.ts';
import type { Subscription } from './logic.ts';
const dayNumber = (iso: string) => { const date = new Date(iso); return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; };
export function subscriptionScheduleAlerts(evidence: LoggedPurchase[], subscriptions: Subscription[], dismissed: string[] = []) {
  return subscriptions.filter(item => item.active && !item.isSample).flatMap(subscription => {
    const anchor = subscription.scheduleUpdatedAt ?? subscription.createdAt;
    if (!anchor || !Number.isFinite(Date.parse(anchor))) return [];
    const key = subscription.bankMerchantKey ?? bankMerchant(subscription.name).key;
    const charges = evidence.filter(row => bankMerchant(row.title).key === key && localDateKey(new Date(row.purchasedAt)) > localDateKey(new Date(anchor))).sort((a, b) => Date.parse(a.purchasedAt) - Date.parse(b.purchasedAt)).slice(-3);
    if (charges.length !== 3) return [];
    const gaps = charges.slice(1).map((row, index) => dayNumber(row.purchasedAt) - dayNumber(charges[index].purchasedAt));
    const cadence = gaps.every(gap => gap >= 25 && gap <= 37) ? 'monthly' as const : gaps.every(gap => gap >= 350 && gap <= 380) ? 'yearly' as const : null;
    if (!cadence) return [];
    const dates = charges.map(row => new Date(row.purchasedAt)), day = dates[2].getDate(), month = dates[2].getMonth() + 1;
    // Never shift an agreed renewal day after a single weekend or holiday delay.
    const stableDay = dates.every(date => date.getDate() === day), difference = Math.min(Math.abs(day - subscription.day), 31 - Math.abs(day - subscription.day));
    if (cadence === subscription.cadence && (!stableDay || difference <= 3) && !(cadence === 'yearly' && dates.every(date => date.getMonth() + 1 === month) && month !== subscription.month)) return [];
    const id = `schedule|${subscription.id}|${charges.map(row => row.id).join('|')}`;
    return dismissed.includes(id) ? [] : [{ id, subscription, cadence, day, month, evidence: charges }];
  });
}
