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

// Validate native output before persisting a selected app in a bill or restored backup.
export function launchableSubscriptionApps(input: unknown): SubscriptionApp[] {
  if (!Array.isArray(input)) throw Error('Invalid installed app list');
  const unique = new Map<string, SubscriptionApp>();
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, packageName } = entry;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
      typeof packageName !== 'string' || packageName.length > 255 || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) continue;
    unique.set(packageName, { name: name.trim(), url: `gasfinder-app://${packageName}` });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}
