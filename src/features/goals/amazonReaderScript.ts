// Shared page reader, stored as source because Hermes does not retain function source.
// Runs in the native WebView and the server DOM; never evaluates page-provided code.
export const AMAZON_READER_SCRIPT = String.raw`function readAmazonDocument(doc, pageUrl) {
  const clean = (text) => (text ?? '').replace(/[\s\x00-\x1f\x7f]+/g, ' ').trim();
  const result = { url: pageUrl, title: '', variant: '', priceCents: null };
  if (doc.querySelector('#captchacharacters, form[action*="validateCaptcha"], #authportal-main-section') ||
    /robot check|service unavailable|sign.in/i.test(clean(doc.querySelector('title')?.textContent))) {
    result.problem = 'blocked'; return result;
  }
  const asin = pageUrl.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-zA-Z0-9]{10})(?:[/?#]|$)/)?.[1].toUpperCase();
  if (!asin) { result.problem = 'blocked'; return result; }
  const pageAsin = doc.querySelector('input#ASIN, input[name="ASIN"]')?.getAttribute('value');
  if (pageAsin && pageAsin.toUpperCase() !== asin) { result.problem = 'blocked'; return result; }
  result.title = clean(doc.querySelector('#productTitle, #title_feature_div h1')?.textContent);
  const variants = doc.querySelectorAll('#twister .selection, #twister_feature_div .selection, #twister-plus-inline-twister .selection');
  const selected = [];
  for (const node of variants) {
    const text = clean(node.textContent);
    if (text && !selected.includes(text)) selected.push(text);
  }
  result.variant = selected.join(' · ').slice(0, 120);
  const availability = clean(doc.querySelector('#availability, #availability_feature_div')?.textContent);
  if (/currently unavailable|temporarily out of stock|unavailable for purchase/i.test(availability)) {
    result.problem = 'unavailable'; return result;
  }

  const usdCents = (text) => {
    const match = clean(text).match(/^(?:US\$|USD\s*\$?|\$)\s*((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{2}))?$/);
    if (!match) return null;
    const cents = Number(match[1].replace(/,/g, '')) * 100 + Number(match[2] ?? '0');
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000 ? cents : null;
  };
  const hidden = (node) => {
    let current = node;
    while (current) {
      if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true' ||
        /(?:^|\s)(?:aok-hidden|a-hidden|a-text-price)(?:\s|$)/.test(current.className) ||
        /display\s*:\s*none|visibility\s*:\s*hidden/i.test(current.getAttribute('style') ?? '')) return true;
      current = current.parentElement;
    }
    return false;
  };
  // Limit reading to the selected offer. Related products, list prices, coupons,
  // used offers and installment amounts must never become the savings target.
  const selectors = [
    '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price)',
    '#corePriceDisplay_mobile_feature_div .a-price:not(.a-text-price)',
    '#corePrice_feature_div .a-price:not(.a-text-price)',
    '#apex_desktop .priceToPay', '#apex_mobile .priceToPay',
    '#priceblock_dealprice', '#priceblock_ourprice', '#newBuyBoxPrice', '#price_inside_buybox',
    '#buybox .a-price:not(.a-text-price)', '#buybox_feature_div .a-price:not(.a-text-price)',
  ];
  const prices = [];
  let foreignCurrency = false;
  for (const selector of selectors) {
    for (const node of doc.querySelectorAll(selector)) {
      if (hidden(node) || node.getAttribute('data-a-strike') === 'true') continue;
      const context = clean(node.parentElement?.textContent);
      if (/\bfrom\b|starting at|\/\s*(?:mo(?:nth)?|each)\b|per month|monthly|installment|\$[\d,.]+\s*[-–]\s*\$/i.test(context)) continue;
      let text = clean(node.querySelector('.a-offscreen')?.textContent ?? node.textContent);
      if (!node.querySelector('.a-offscreen') && node.querySelector('.a-price-whole')) {
        text = clean(node.querySelector('.a-price-symbol')?.textContent) +
          clean(node.querySelector('.a-price-whole')?.textContent).replace(/\.$/, '') + '.' +
          clean(node.querySelector('.a-price-fraction')?.textContent);
      }
      if (/€|£|₹|¥|(?:CA|CDN|AU|A|C|MX|R)\$|\b(?:EUR|GBP|CAD|AUD|INR|JPY)\b/.test(text)) foreignCurrency = true;
      const cents = usdCents(text);
      if (cents !== null && !prices.includes(cents)) prices.push(cents);
    }
  }
  // Structured data is a fallback only for a single, explicitly identified USD
  // offer for this ASIN. Aggregate or competing offers are ambiguous.
  if (!prices.length && !foreignCurrency) {
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      if ((script.textContent?.length ?? 0) > 100_000) continue;
      try {
        const json = JSON.parse(script.textContent ?? '');
        const entries = Array.isArray(json) ? json : Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
        for (const entry of entries) {
          if (entry?.['@type'] !== 'Product') continue;
          const identity = String(entry.sku ?? entry.asin ?? '').toUpperCase();
          const urlAsin = String(entry.url ?? '').match(/\/dp\/([a-zA-Z0-9]{10})(?:[/?#]|$)/)?.[1].toUpperCase();
          if (identity !== asin && urlAsin !== asin) continue;
          if (!result.title && typeof entry.name === 'string') result.title = clean(entry.name);
          const offers = Array.isArray(entry.offers) ? entry.offers : [entry.offers];
          if (offers.length !== 1 || offers[0]?.['@type'] !== 'Offer') continue;
          const offer = offers[0];
          if (offer.availability && !/\/(?:InStock|LimitedAvailability)$/.test(offer.availability)) continue;
          if (offer.priceCurrency !== 'USD') { foreignCurrency = true; continue; }
          if (typeof offer.price !== 'string' && typeof offer.price !== 'number') continue;
          const cents = usdCents('$' + String(offer.price));
          if (cents !== null && !prices.includes(cents)) prices.push(cents);
        }
      } catch { /* Invalid structured data cannot supply a price. */ }
    }
  }
  if (foreignCurrency) result.problem = 'unsupported-currency';
  else if (prices.length === 1 && result.title) result.priceCents = prices[0];
  else result.problem = 'missing-price';
  return result;
}
`;
