import { parseAmazonLink } from './amazonLink.ts';

// Bound user-supplied share/clipboard text separately from the stricter 2 KB
// URL limit. A mobile share may prepend a product name and descriptive text.
export const MAX_AMAZON_INPUT_LENGTH = 16_384;

export function parseAmazonInput(input: string): ReturnType<typeof parseAmazonLink> {
  if (input.length > MAX_AMAZON_INPUT_LENGTH) return { error: 'This shared text is too long. Copy the Amazon product link again.' };
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) return { error: 'Paste an Amazon link or the product name and link copied from Amazon.' };
  const direct = parseAmazonLink(input);
  if (direct.value) return direct;
  // Never trust surrounding prose or its title as product metadata. Every
  // candidate still passes the same host, scheme and listing checks as a URL.
  const urls = input.match(/https?:\/\/[^\s<>"'“”‘’\x00-\x1f]+/gi) ?? [];
  for (const candidate of urls.slice(0, 32)) {
    const parsed = parseAmazonLink(candidate.replace(/[),.;!\]}]+$/, ''));
    if (parsed.value) return parsed;
  }
  return direct;
}
