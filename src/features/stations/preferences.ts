export type MapsApp = 'apple' | 'google';

export function validateRefillPercent(value: number) {
  if (!Number.isFinite(value) || value < 5 || value > 50) throw new Error('Choose a refill level from 5% to 50% of a full tank.');
  return value;
}

export function preferredMapsApp(preference: MapsApp | null, platform: string): MapsApp {
  return platform === 'ios' ? preference ?? 'apple' : 'google';
}
