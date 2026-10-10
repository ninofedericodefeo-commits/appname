import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { registerBankFile } from '@/features/bank/incomingBankFile';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const fileToken = registerBankFile(path);
    if (fileToken) return `/bank-import?bankFileToken=${fileToken}`;
    if (new URL(path, 'gasfinder://').hostname !== 'expo-sharing') return path;
    const payloads = getSharedPayloads();
    const file = payloads.find((payload) => payload.shareType === 'file');
    const sharedToken = file ? registerBankFile(file.value, file.mimeType ?? undefined, Date.now(), true) : null;
    const value = payloads.find((payload) => payload.shareType === 'url' || payload.shareType === 'text')?.value;
    clearSharedPayloads();
    if (sharedToken) return `/bank-import?bankFileToken=${sharedToken}`;
    if (file) return '/bank-import';
    return value ? `/on-route?destination=${encodeURIComponent(value)}&handoff=${Date.now()}` : '/on-route';
  } catch { return path; }
}
