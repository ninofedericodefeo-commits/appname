export type AmazonLink = { sourceUrl: `https://${string}`; asin: string | null; kind: 'product' | 'short' };

export type AmazonProductDraft = {
  sourceUrl: string;
  asin: string | null;
  title: string;
  variant: string;
  currency: 'USD';
  priceCents: number | null;
  priceReadAt: string | null;
  priceSource: 'manual';
};

export type AmazonProductGoal = AmazonProductDraft & { priceCents: number; priceReadAt: string };

// Parse locally. Short links are retained without fetching or following redirects.
export function parseAmazonLink(input: string): { value: AmazonLink; error?: never } | { value?: never; error: string } {
  const text = input.trim();
  if (!text || text.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(text)) return { error: 'Paste one Amazon product link.' };
  let url: URL;
  try { url = new URL(text); }
  catch { return { error: 'Paste a complete link starting with https://.' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return { error: 'Use an HTTPS Amazon link without a login or custom port.' };

  if (url.hostname === 'a.co') {
    if (/^\/d\/?$/.test(url.pathname) || !/^\/(?:d\/)?[a-zA-Z0-9]{1,64}\/?$/.test(url.pathname)) return { error: 'This short link is incomplete. Copy the product link from Amazon again.' };
    return { value: { sourceUrl: `https://a.co${url.pathname.replace(/\/$/, '')}`, asin: null, kind: 'short' } };
  }
  if (!['amazon.com', 'www.amazon.com', 'm.amazon.com'].includes(url.hostname)) return { error: 'Use an amazon.com product link or an a.co short link. This flow supports USD only.' };
  const product = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-zA-Z0-9]{10})(?:\/|$)/);
  if (!product) return { error: 'This is not a product link. Open the item on Amazon and copy its product link.' };
  const asin = product[1].toUpperCase();
  return { value: { sourceUrl: `https://www.amazon.com/dp/${asin}`, asin, kind: 'product' } };
}

export function amazonProductDraft(link: AmazonLink): AmazonProductDraft {
  return { sourceUrl: link.sourceUrl, asin: link.asin, title: '', variant: '', currency: 'USD', priceCents: null, priceReadAt: null, priceSource: 'manual' };
}

const validText = (value: unknown, max: number, required = false) => typeof value === 'string' &&
  value === value.trim() && value.length <= max && (!required || value.length > 0) && !/[\x00-\x1f\x7f]/.test(value);

export function validAmazonProductGoal(product: AmazonProductGoal) {
  if (!product || typeof product.sourceUrl !== 'string') return false;
  const link = parseAmazonLink(product.sourceUrl).value;
  return !!link && link.sourceUrl === product.sourceUrl && link.asin === product.asin &&
    validText(product.title, 80, true) && validText(product.variant, 120) && product.currency === 'USD' &&
    product.priceSource === 'manual' && Number.isSafeInteger(product.priceCents) && product.priceCents > 0 && product.priceCents <= 100_000_000 &&
    typeof product.priceReadAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(product.priceReadAt) && Number.isFinite(Date.parse(product.priceReadAt));
}

export function confirmAmazonProduct(draft: AmazonProductDraft, title: string, priceCents: number, variant: string, now = new Date()): AmazonProductGoal | null {
  const product: AmazonProductGoal = {
    ...draft, title: title.trim(), variant: variant.trim(), priceCents,
    priceReadAt: draft.priceCents === priceCents && draft.priceReadAt ? draft.priceReadAt : now.toISOString(),
  };
  return validAmazonProductGoal(product) ? product : null;
}
