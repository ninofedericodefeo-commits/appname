// Device security preferences deliberately stay outside portable backups.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appStorage } from '@/lib/appStorage';
export const useDevicePrivacy = create<{ enabled: boolean; hidePreview: boolean; relockSeconds: number; configure: (change: Partial<{ enabled: boolean; hidePreview: boolean; relockSeconds: number }>) => void }>()(persist(set => ({
  enabled: false, hidePreview: false, relockSeconds: 60,
  configure: change => set(change),
}), { name: 'gasfinder-device-privacy', version: 1, storage: createJSONStorage(() => appStorage) }));
export const usePrivacySession = create<{ unlocked: boolean; warning: string }>(() => ({ unlocked: false, warning: '' }));
