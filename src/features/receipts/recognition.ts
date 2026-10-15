import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { ReceiptTextLine } from './textCandidates';
const module = Platform.OS === 'web' ? null : requireOptionalNativeModule<{ recognize: (uri: string) => Promise<ReceiptTextLine[]> }>('ReceiptOcr');
export const receiptReadingAvailable = !!module;
export async function readReceiptText(uri: string) {
  if (!module) throw new Error('On-device receipt reading needs the updated native app build. You can still enter every field manually.');
  const lines = await module.recognize(uri);
  return lines.filter(line => typeof line.text === 'string' && Number.isFinite(line.confidence)).slice(0, 400);
}
