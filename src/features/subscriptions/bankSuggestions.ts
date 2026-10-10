import type { LoggedPurchase } from '../goals/logic.ts';
import type { Subscription } from './logic.ts';

export type BankSubscriptionSuggestion = {
  key: string; merchantKey: string; name: string; amountCents: number;
  cadence: Subscription['cadence']; day: number; month: number;
  confidence: 'repeated' | 'possible';
  evidence: { id: string; date: string; amountCents: number }[];
};

const providers: [RegExp, string][] = [
  [/\bnetflix\b/i, 'Netflix'], [/\bspotify\b/i, 'Spotify'], [/\bhulu\b/i, 'Hulu'],
  [/\bdisney(?:\s*\+|plus)\b|\bdisney\+/i, 'Disney+'], [/\b(?:amazon|amzn)\s*prime\b/i, 'Amazon Prime'],
  [/\badobe\b/i, 'Adobe'], [/\byoutube\s*(?:premium|tv)\b/i, 'YouTube'],
  [/\b(?:microsoft|msft)\s*365\b/i, 'Microsoft 365'], [/\bapple\s*music\b/i, 'Apple Music'], [/\bicloud\b/i, 'iCloud'],
];

export function bankMerchant(title: string) {
  const provider = providers.find(([pattern]) => pattern.test(title));
  const name = provider?.[1] ?? title
    .replace(/^(?:(?:recurring|pos|debit card|card purchase|ach debit|checkcard|visa|purchase|payment)\s*)+/i, '')
    .replace(/\b(?:ref(?:erence)?|trace|auth(?:orization)?|confirmation|card ending)\s*[:#-]?\s*[\w-]+/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{3,}\b|[*#]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 80);
  return { name, key: name.toLowerCase().replace(/[^a-z0-9]/g, ''), known: !!provider };
}

const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

export function suggestBankSubscriptions(history: LoggedPurchase[], subscriptions: Subscription[], dismissed: string[] = [], now = new Date()): BankSubscriptionSuggestion[] {
  const groups = new Map<string, { merchant: ReturnType<typeof bankMerchant>; charges: LoggedPurchase[] }>();
  const seen = new Set<string>();
  const existing = new Set(subscriptions.flatMap((subscription) => [subscription.bankMerchantKey, bankMerchant(subscription.name).key]).filter(Boolean));
  for (const record of history) {
    const purchase = { ...record, title: record.bankDescription ?? record.title, purchasedAt: record.bankPostedAt ?? record.purchasedAt };
    const date = new Date(purchase.purchasedAt);
    if ((purchase.source !== 'bank-import' && !purchase.bankSource) || seen.has(purchase.id) || !Number.isSafeInteger(purchase.amountCents) || purchase.amountCents <= 0 ||
      !Number.isFinite(date.getTime()) || date > now || calendarDay(now) - calendarDay(date) > 800 ||
      /\b(?:transfer|xfer|zelle|venmo|cash app|refund|reversal|atm|fee|overdraft|loan|mortgage)\b|credit card payment|cardmember payment/i.test(purchase.title)) continue;
    seen.add(purchase.id);
    const merchant = bankMerchant(purchase.title);
    if (!merchant.key || merchant.key.length < 3 || existing.has(merchant.key)) continue;
    const group = groups.get(merchant.key) ?? { merchant, charges: [] };
    group.charges.push(purchase); groups.set(merchant.key, group);
  }
  const suggestions: BankSubscriptionSuggestion[] = [];
  for (const [merchantKey, { merchant, charges }] of groups) {
    const recent = charges.sort((a, b) => Date.parse(a.purchasedAt) - Date.parse(b.purchasedAt)).slice(-6);
    const last = recent.at(-1)!;
    const gaps = recent.slice(1).map((charge, index) => calendarDay(new Date(charge.purchasedAt)) - calendarDay(new Date(recent[index].purchasedAt)));
    const steadyPrice = recent.every((charge) => Math.abs(charge.amountCents - last.amountCents) <= Math.max(100, last.amountCents * 0.2));
    let cadence: Subscription['cadence'] | undefined;
    let confidence: BankSubscriptionSuggestion['confidence'] = 'repeated';
    if (gaps.length && steadyPrice && gaps.every((gap) => gap >= 25 && gap <= 37)) cadence = 'monthly';
    else if (gaps.length && steadyPrice && gaps.every((gap) => gap >= 350 && gap <= 380)) cadence = 'yearly';
    else if (recent.length === 1 && (merchant.known || last.recurringHint || /\brecurring\b/i.test(last.title))) { cadence = 'monthly'; confidence = 'possible'; }
    if (!cadence) continue;
    const date = new Date(last.purchasedAt);
    if (calendarDay(now) - calendarDay(date) > (cadence === 'monthly' ? 65 : 400)) continue;
    const key = `${merchantKey}|${cadence}`;
    if (dismissed.includes(key)) continue;
    suggestions.push({ key, merchantKey, name: merchant.name, amountCents: last.amountCents, cadence, day: date.getDate(), month: date.getMonth() + 1,
      confidence, evidence: recent.map((charge) => ({ id: charge.id, date: charge.purchasedAt, amountCents: charge.amountCents })) });
  }
  return suggestions.sort((a, b) => Number(a.confidence === 'possible') - Number(b.confidence === 'possible') || a.name.localeCompare(b.name));
}
