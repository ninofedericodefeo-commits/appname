import type { Subscription } from './logic.ts';
import { openSubscriptionApp, subscriptionAppURL } from './providerApps.ts';
export type BillingChannel = 'unknown' | 'apple' | 'google' | 'website' | 'app';
export const billingChannels: { id: BillingChannel; label: string }[] = [{ id: 'unknown', label: 'Not sure yet' }, { id: 'apple', label: 'Apple' }, { id: 'google', label: 'Google Play' }, { id: 'website', label: 'Provider website' }, { id: 'app', label: 'Provider app' }];
// Starting pages checked against official billing instructions on 2026-10-14.
export const verifiedBilling = [
  { key: 'spotify', url: 'https://www.spotify.com/account/subscription/', help: 'https://support.spotify.com/us/article/cancel-premium/', instructions: 'Open Manage your plan and follow the cancellation steps. Partner-billed plans must be managed with the partner.' },
  { key: 'netflix', url: 'https://www.netflix.com/cancelplan', help: 'https://help.netflix.com/en/node/407', instructions: 'Follow the membership cancellation steps and keep the confirmation. Partner-billed plans may redirect to that provider.' },
];
export function billingDestination(subscription: Subscription, platform: string) {
  if (subscription.billingChannel === 'apple') return { name: 'Apple subscriptions', url: platform === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://account.apple.com/', instructions: 'Use the Apple Account that paid for this subscription. Select the subscription and complete cancellation.' };
  if (subscription.billingChannel === 'google') return { name: 'Google Play subscriptions', url: 'https://play.google.com/store/account/subscriptions', instructions: 'Use the Google Account that paid for this subscription. Select it and follow Cancel subscription.' };
  if (subscription.billingChannel === 'website') {
    const provider = verifiedBilling.find(item => `${subscription.name} ${subscription.associatedApp?.name ?? ''}`.toLowerCase().includes(item.key));
    const url = provider?.url ?? subscription.associatedApp?.fallbackUrl ?? (subscription.associatedApp?.url.startsWith('https:') ? subscription.associatedApp.url : undefined);
    return url ? { name: 'Provider billing', url: subscriptionAppURL(url, true), instructions: provider?.instructions ?? 'Open billing or subscription settings and complete the provider’s cancellation steps.' } : null;
  }
  return null;
}
export async function openCancellationDestination(subscription: Subscription, openURL: (url: string) => Promise<unknown>, platform: string) {
  const destination = billingDestination(subscription, platform);
  if (destination) {
    try { if (await openURL(destination.url) === false) throw new Error('Unavailable'); return { opened: true, message: `${destination.instructions} Opening this page does not mark the subscription canceled in Tally.` }; }
    catch { return { opened: false, message: 'Cancellation plan saved. The billing page could not open. Retry or open the provider’s billing settings manually.' }; }
  }
  if (subscription.billingChannel === 'website') return { opened: false, message: 'Cancellation plan saved. Choose an associated provider app in Edit to find its account website, or visit its billing page manually.' };
  const result = await openSubscriptionApp(subscription.associatedApp, openURL, platform);
  return { ...result, message: subscription.billingChannel === 'unknown' ? `${result.message} Check your receipt to confirm whether Apple, Google Play or the provider bills you.` : result.message };
}
