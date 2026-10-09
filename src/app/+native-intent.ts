import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path, 'gasfinder://').hostname !== 'expo-sharing') return path;
    const value = getSharedPayloads().find((payload) => payload.shareType === 'url' || payload.shareType === 'text')?.value;
    clearSharedPayloads();
    return value ? `/on-route?destination=${encodeURIComponent(value)}&handoff=${Date.now()}` : '/on-route';
  } catch { return path; }
}
