import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAmazonLink, confirmAmazonProduct } from '../src/features/goals/amazonLink.ts';
import { draftFromAmazonPage } from '../src/features/goals/amazonPage.ts';
import { fetchAmazonPage, readAmazonHtml, readBoundedText } from '../src/features/goals/amazonLookup.server.ts';
import { createGoalFromInput, editGoalFromInput } from '../src/features/goals/logic.ts';

const url = 'https://www.amazon.com/dp/B0ABC12345';
const link = parseAmazonLink(url).value;
const now = new Date('2026-10-10T12:00:00Z');
const html = (body, head = '') => `<html><head><title>Amazon.com product</title>${head}</head><body><input id="ASIN" value="B0ABC12345"><span id="productTitle"> Studio &amp; travel headphones </span>${body}</body></html>`;
const price = (amount, classes = '') => `<span class="a-price ${classes}"><span class="a-offscreen">${amount}</span><span aria-hidden="true">${amount}</span></span>`;
const core = (body) => `<div id="corePriceDisplay_desktop_feature_div">${body}</div>`;
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } });

test('A selected sale offer autofills decoded name, exact USD cents, variant and timestamp', () => {
  const page = readAmazonHtml(html(core(`<div>${price('$79.99')}</div><div>List price: ${price('$129.99', 'a-text-price')}</div>`) + '<div id="twister"><span class="selection">Black</span></div><div id="recommendations">' + price('$19.99') + '</div>'), url);
  assert.equal(page.title, 'Studio & travel headphones');
  assert.equal(page.priceCents, 7999);
  assert.equal(page.variant, 'Black');
  const result = draftFromAmazonPage(link, page, now);
  assert.equal(result.message, undefined);
  assert.equal(result.draft.priceCents, 7999);
  assert.equal(result.draft.priceSource, 'amazon-page');
  assert.equal(result.draft.priceReadAt, now.toISOString());
});

test('Mobile offer markup supports split dollars and cents; hidden prices do not conflict', () => {
  const page = readAmazonHtml(html('<div id="corePriceDisplay_mobile_feature_div"><div><span class="a-price"><span class="a-price-symbol">$</span><span class="a-price-whole">1,234.</span><span class="a-price-fraction">56</span></span></div><div style="display:none">' + price('$999.00') + '</div></div>'), url);
  assert.equal(page.priceCents, 123456);
});

test('From, ranges, installment, coupon-only, used-only and conflicting offers leave the price blank', () => {
  for (const body of [
    core('From ' + price('$9.99')),
    core(price('$9.99') + ' - $19.99'),
    core(price('$9.99') + '/mo for 12 months'),
    core('Monthly installment ' + price('$9.99')),
    '<div id="coupon_feature_div">' + price('$5.00') + ' coupon</div>',
    '<div id="usedBuySection">' + price('$39.99') + '</div>',
    core('<div>' + price('$59.99') + '</div><div>' + price('$79.99') + '</div>'),
    core(price('$0.00')), core(price('$1.999')), core(price('$1,00.00')),
  ]) {
    const page = readAmazonHtml(html(body), url);
    assert.equal(page.priceCents, null, body);
    assert.ok(draftFromAmazonPage(link, page).message);
    assert.equal(draftFromAmazonPage(link, page).draft.title, 'Studio & travel headphones');
  }
});

test('Unavailable, foreign currency, CAPTCHA and sign-in pages never supply a target', () => {
  for (const body of [
    core(price('CA$49.99')), core(price('£49.99')), core(price('€49.99')),
    '<div id="availability">Currently unavailable.</div>' + core(price('$49.99')),
    '<input id="captchacharacters">' + core(price('$49.99')),
    '<div id="authportal-main-section"></div>' + core(price('$49.99')),
  ]) {
    const page = readAmazonHtml(html(body), url);
    assert.equal(page.priceCents, null);
    assert.equal(draftFromAmazonPage(link, page).draft.priceCents, null);
  }
});

test('Structured metadata must identify this ASIN and one current USD Offer', () => {
  const metadata = (overrides = {}) => html('', `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku: link.asin, name: 'Headphones', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }, ...overrides })}</script>`);
  assert.equal(readAmazonHtml(metadata(), url).priceCents, 4999);
  for (const changes of [
    { sku: 'B0WRONG123' },
    { offers: { '@type': 'AggregateOffer', lowPrice: '9.99', priceCurrency: 'USD' } },
    { offers: [{ '@type': 'Offer', price: '49.99', priceCurrency: 'USD' }, { '@type': 'Offer', price: '39.99', priceCurrency: 'USD' }] },
    { offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'CAD' } },
    { offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'USD', availability: 'https://schema.org/OutOfStock' } },
  ]) assert.equal(readAmazonHtml(metadata(changes), url).priceCents, null);
});

test('Lookup results resolve short links and reject mismatched identity and malformed bridge data', () => {
  const page = readAmazonHtml(html(core(price('$49.99'))), url);
  const short = parseAmazonLink('https://a.co/d/Abc123').value;
  assert.equal(draftFromAmazonPage(short, page).draft.sourceUrl, url);
  assert.equal(draftFromAmazonPage(short, page).draft.asin, link.asin);
  for (const data of [null, {}, { ...page, url: 'https://evil.test/dp/B0ABC12345' }, { ...page, url: 'https://amazon.com/dp/B0WRONG123' }, { ...page, priceCents: '4999' }, { ...page, priceCents: 1.5 }, { ...page, priceCents: 100_000_001 }]) {
    assert.equal(draftFromAmazonPage(link, data).draft.priceCents, null);
  }
  const long = draftFromAmazonPage(link, { ...page, title: 'Headphones '.repeat(30) });
  assert.ok(long.draft.title.length <= 80);
  assert.equal(confirmAmazonProduct(long.draft, long.draft.title, 4999, '', now).priceCents, 4999);
  assert.equal(readAmazonHtml(html(core(price('$49.99'))).replace('value="B0ABC12345"', 'value="B0WRONG123"'), url).priceCents, null);
});

test('Confirmation preserves imported price provenance; edited targets become manual and retain saved money', () => {
  const draft = draftFromAmazonPage(link, readAmazonHtml(html(core(price('$49.99')) + '<div id="twister"><span class="selection">Black</span></div>'), url), now).draft;
  const later = new Date('2026-10-11T12:00:00Z');
  const product = confirmAmazonProduct(draft, 'My headphones', 4999, 'Black', later);
  assert.equal(product.priceSource, 'amazon-page');
  assert.equal(product.priceReadAt, now.toISOString());
  const changedOption = confirmAmazonProduct(product, product.title, 4999, 'Silver', later);
  assert.equal(changedOption.priceSource, 'manual');
  assert.equal(changedOption.priceReadAt, later.toISOString());
  const input = { title: product.title, kind: 'item', targetCents: 4999, deadline: null, setAsideRule: { mode: 'fixed', cents: 100 }, product };
  const goal = createGoalFromInput(input, 3000, true, 'goal', now);
  const editedProduct = confirmAmazonProduct(product, product.title, 6000, 'Black', later);
  assert.equal(editedProduct.priceSource, 'manual');
  assert.equal(editedProduct.priceReadAt, later.toISOString());
  const edited = editGoalFromInput(goal, { ...input, targetCents: 6000, product: editedProduct });
  assert.equal(edited.savedCents, 3000);
  assert.equal(edited.id, goal.id);
  const { product: ignored, ...legacyInput } = input;
  assert.equal(editGoalFromInput(goal, { ...legacyInput, targetCents: 6000 }).product.priceSource, 'manual');
});

test('The server resolves a short link only through allowed HTTPS product destinations', async () => {
  const short = parseAmazonLink('https://a.co/d/Abc123').value;
  const requests = [];
  const page = await fetchAmazonPage(short, async (destination, options) => {
    requests.push(destination);
    assert.equal(options.redirect, 'manual');
    return destination === short.sourceUrl ? response('', 302, { location: url }) : response(html(core(price('$49.99'))));
  });
  assert.deepEqual(requests, [short.sourceUrl, url]);
  assert.equal(page.priceCents, 4999);
  for (const destination of ['http://amazon.com/dp/B0ABC12345', 'https://127.0.0.1/', 'https://amazon.com.evil.test/dp/B0ABC12345', 'https://amazon.co.uk/dp/B0ABC12345', 'https://amazon.com/ap/signin', 'https://amazon.com:8443/dp/B0ABC12345']) {
    let count = 0;
    await assert.rejects(fetchAmazonPage(short, async () => { count++; return response('', 302, { location: destination }); }));
    assert.equal(count, 1, destination);
  }
});

test('Server rejects ASIN changes, loops, blocked/oversized/non-HTML responses and cancelled requests', async () => {
  await assert.rejects(fetchAmazonPage(link, async () => response('', 302, { location: 'https://amazon.com/dp/B0WRONG123' })));
  let redirects = 0;
  await assert.rejects(fetchAmazonPage(link, async () => { redirects++; return response('', 302, { location: url }); }));
  assert.equal(redirects, 5);
  for (const result of [response('blocked', 503), response('json', 200, { 'content-type': 'application/json' }), response('too big', 200, { 'content-length': '3000001' })]) {
    await assert.rejects(fetchAmazonPage(link, async () => result));
  }
  await assert.rejects(readBoundedText(response('12345'), 4));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchAmazonPage(link, async (_, options) => { options.signal.throwIfAborted(); return response(''); }, controller.signal));
});
