import { amazonProductDraft, parseAmazonLink } from './amazonLink.ts';
import type { AmazonLink, AmazonProductDraft } from './amazonLink.ts';

export type AmazonPageData = {
  url: string;
  title: string;
  variant: string;
  priceCents: number | null;
  problem?: 'blocked' | 'missing-price' | 'unavailable' | 'unsupported-currency';
};
export type AmazonLookupResult = { draft: AmazonProductDraft; message?: string };
export function amazonLookupFallback(link: AmazonLink, message = 'Could not read Amazon right now. You can retry or enter the product name and full USD price.'): AmazonLookupResult {
  return { draft: amazonProductDraft(link), message };
}

export function draftFromAmazonPage(link: AmazonLink, data: unknown, now = new Date()): AmazonLookupResult {
  if (!data || typeof data !== 'object') return amazonLookupFallback(link);
  const page = data as Partial<AmazonPageData>;
  const resolved = typeof page.url === 'string' ? parseAmazonLink(page.url).value : undefined;
  if (!resolved || resolved.kind !== 'product' || (link.asin && resolved.asin !== link.asin) || page.problem === 'blocked') {
    return amazonLookupFallback(link, 'Amazon did not provide this product page. Retry or enter its name and full USD price.');
  }
  const draft = amazonProductDraft(resolved);
  if (typeof page.title === 'string' && page.title.length <= 1000) draft.title = page.title.replace(/[\s\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 80).trim();
  if (typeof page.variant === 'string') draft.variant = page.variant.replace(/[\s\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 120).trim();
  const price = page.priceCents;
  if (!page.problem && draft.title && typeof price === 'number' && Number.isSafeInteger(price) && price > 0 && price <= 100_000_000) {
    draft.priceCents = price;
    draft.priceReadAt = now.toISOString();
    draft.priceSource = 'amazon-page';
    return { draft };
  }
  const message = page.problem === 'unsupported-currency' ? 'Amazon showed a different currency. Enter the full USD price to continue.' :
    page.problem === 'unavailable' ? 'Amazon lists this item as unavailable. Enter a USD savings target if you still want to save for it.' :
      draft.title ? 'The product name is filled in. Amazon did not show one clear full price; enter the USD price for your selected option.' :
        'Could not read the product details. Retry or enter the product name and full USD price.';
  return { draft, message };
}

export type AmazonLookupProps = { link: AmazonLink; onResult: (result: AmazonLookupResult) => void };
