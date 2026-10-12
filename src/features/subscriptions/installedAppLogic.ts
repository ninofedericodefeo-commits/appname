import type { SubscriptionApp } from './providerApps';

export type InstalledAppResult = { status: 'ready' | 'web' | 'update-required' | 'error'; apps: SubscriptionApp[] };

export async function detectInstalledApps(platform: string, catalog: SubscriptionApp[], configuredSchemes: string[] | null,
  canOpenURL: (url: string) => Promise<boolean>): Promise<InstalledAppResult> {
  if (platform === 'web') return { status: 'web', apps: [] };
  // Distinguish a stale native build from a phone with no matching apps.
  if (!configuredSchemes || catalog.some(app => !configuredSchemes.includes(app.url.split(':')[0]))) {
    return { status: 'update-required', apps: [] };
  }
  const results = await Promise.allSettled(catalog.map(async app => await canOpenURL(app.url) ? app : null));
  const apps = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []).sort((a, b) => a.name.localeCompare(b.name));
  return { status: results.some(result => result.status === 'rejected') ? 'error' : 'ready', apps };
}
