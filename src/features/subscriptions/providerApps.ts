import appCatalog from './appCatalog.json' with { type: 'json' };
export type SubscriptionApp = { name: string; url: string; fallbackUrl?: string };

// Shared with the native configuration; HTTPS links cannot detect installation.
export const SUBSCRIPTION_APPS: SubscriptionApp[] = appCatalog;
export const APPLE_SUBSCRIPTIONS: SubscriptionApp = { name: 'Apple subscriptions', url: 'https://apps.apple.com/account/subscriptions' };

export function subscriptionAppURL(input: string, websiteOnly = false): string {
  const value = input.trim();
  if (!value || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) throw Error('Enter a valid app link or HTTPS website.');
  let url: URL;
  try { url = new URL(value); } catch { throw Error('Use a full HTTPS website or an app link, such as spotify:.'); }
  const scheme = url.protocol.toLowerCase();
  if (scheme === 'gasfinder-app:') {
    if (websiteOnly || !/^gasfinder-app:\/\/[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value) || value.length > 271) throw Error('Invalid installed app link.');
    return value;
  }
  if (url.username || url.password || (websiteOnly && scheme !== 'https:') ||
    /^(?:javascript|vbscript|data|file|http|intent|tel|sms|mailto|facetime|app-prefs|prefs|itms-services|exp|expo|gasfinder):$/.test(scheme) ||
    (scheme === 'https:' && (!url.hostname.includes('.') || url.port))) throw Error('Use an app link or HTTPS website without a login or port.');
  return scheme === 'https:' ? url.href : scheme + value.slice(value.indexOf(':') + 1);
}

export function subscriptionApp(input: SubscriptionApp): SubscriptionApp {
  const name = input.name.trim();
  if (!name || name.length > 80) throw Error('Enter the associated app’s name.');
  const url = subscriptionAppURL(input.url);
  const fallbackUrl = input.fallbackUrl?.trim() ? subscriptionAppURL(input.fallbackUrl, true) : undefined;
  return { name, url, ...(fallbackUrl ? { fallbackUrl } : {}) };
}

export async function openSubscriptionApp(input: SubscriptionApp | undefined, openURL: (url: string) => Promise<unknown>, platform: string, openPackage?: (packageName: string) => Promise<unknown>) {
  if (!input) return { opened: false, message: 'Cancellation plan saved. Cancel with the provider to stop the charge.' };
  let app: SubscriptionApp;
  try { app = subscriptionApp(input); }
  catch { return { opened: false, message: 'Cancellation plan saved. Edit this subscription to choose its app again.' }; }
  const packageApp = app.url.startsWith('gasfinder-app:');
  const website = app.url.startsWith('https:');
  const target = ((platform === 'web' && !website) || (packageApp && platform !== 'android')) ? app.fallbackUrl : app.url;
  if (!target) return { opened: false, message: 'Cancellation plan saved. Open the associated app on your phone to cancel.' };
  try {
    const opened = packageApp && target === app.url
      ? await (openPackage ?? (await import('./installedApps')).openInstalledPackage)(target.slice('gasfinder-app://'.length))
      : await openURL(target);
    if (opened === false) throw Error('Unavailable');
    return { opened: true, message: `Opened ${app.name}. Complete cancellation there; the subscription is still active in Savemage.` };
  } catch {
    if (app.fallbackUrl && app.fallbackUrl !== target) {
      try {
        if (await openURL(app.fallbackUrl) === false) throw Error('Unavailable');
        return { opened: true, message: `Opened ${app.name}’s website because its app could not open. Complete cancellation there.` };
      } catch { /* Report a recoverable error without exposing the private link. */ }
    }
    return { opened: false, message: `Cancellation plan saved. Could not open ${app.name}. Open it manually or choose another app.` };
  }
}
