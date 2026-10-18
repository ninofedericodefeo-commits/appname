import { parseAmazonLink } from '../goals/amazonLink.ts';
import { parseAmazonInput } from '../goals/amazonInput.ts';

type SharedPayload = { shareType: string; value: string; mimeType?: string | null };
type RegisterFile = (uri: string, mimeType?: string, now?: number, shareCopy?: boolean) => string | null;

// This also distinguishes two shares of the same product in a warm app, even
// when both deliveries occur within one millisecond. It is not an auth token.
let delivery = 0;
const nextHandoff = () => `${Date.now().toString(36)}-${++delivery}`;
const productRoute = (url: string, handoff: string) => `/amazon-goal?product=${encodeURIComponent(url)}&handoff=${encodeURIComponent(handoff)}`;

export function incomingAmazonUrl(text: string): string | null {
  return parseAmazonInput(text).value?.sourceUrl ?? null;
}

export function sharedPayloadRoute(payloads: unknown, registerFile: RegisterFile, handoff = nextHandoff()): string {
  if (!Array.isArray(payloads)) return '/on-route';
  const items = payloads.slice(0, 32).filter((item): item is SharedPayload => !!item &&
    typeof item === 'object' && typeof item.value === 'string' && typeof item.shareType === 'string' &&
    item.value.length <= 16_384 && (item.mimeType == null || typeof item.mimeType === 'string'));
  const files = items.filter((item) => item.shareType === 'file');
  // A bank statement takes precedence over text or URLs accompanying the file.
  for (const file of files) {
    const token = registerFile(file.value, file.mimeType ?? undefined, Date.now(), true);
    if (token) return `/bank-import?bankFileToken=${encodeURIComponent(token)}`;
  }
  if (files.length) return '/bank-import';
  const text = items.filter((item) => item.shareType === 'url' || item.shareType === 'text');
  for (const item of text) {
    const product = incomingAmazonUrl(item.value);
    if (product) return productRoute(product, handoff);
  }
  const destination = text.find((item) => item.value.trim())?.value;
  return destination ? `/on-route?destination=${encodeURIComponent(destination)}&handoff=${encodeURIComponent(handoff)}` : '/on-route';
}

export function directAmazonRoute(path: string): string | null {
  const parsed = parseAmazonLink(path).value;
  return parsed ? productRoute(parsed.sourceUrl, nextHandoff()) : null;
}

export function isSharingPath(path: string): boolean {
  try { return new URL(path, 'gasfinder://').hostname === 'expo-sharing'; }
  catch { return false; }
}
