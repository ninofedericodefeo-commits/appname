import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { registerBankFile } from '@/features/bank/incomingBankFile';
import { directAmazonRoute, isSharingPath, sharedPayloadRoute } from '@/features/sharing/incomingShare';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const fileToken = registerBankFile(path);
    if (fileToken) return `/bank-import?bankFileToken=${fileToken}`;
    if (!isSharingPath(path)) return directAmazonRoute(path) ?? path;
    try { return sharedPayloadRoute(getSharedPayloads(), registerBankFile); }
    finally { clearSharedPayloads(); }
  } catch { return isSharingPath(path) ? '/investment' : path; }
}
