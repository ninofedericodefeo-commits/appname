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

test('Autos fills the vehicle name but never uses financing, lease, deposit or listed amounts as a full target', () => {
  const vehicleUrl = 'https://www.amazon.com/vindp/B0HK2T5GPL';
  const vehicle = parseAmazonLink(vehicleUrl).value;
  const body = '<html><head><title>New 2026 Chevrolet Trax FWD LS</title></head><body>' +
    core(price('$396.00') + '/mo') + '<div>$5,000 down · Lease $375 /mo · Deposit $500</div>' +
    '<div>Listed price $24,094 · Your vehicle price $23,594</div>' +
    '<h1>Included Coverage</h1></body></html>';
  const page = readAmazonHtml(body, vehicleUrl);
  assert.equal(page.title, 'New 2026 Chevrolet Trax FWD LS');
  assert.equal(page.priceCents, null);
  assert.equal(page.problem, 'manual-vehicle-price');
  for (const selected of [vehicle, parseAmazonLink('https://a.co/d/Car123').value]) {
    const result = draftFromAmazonPage(selected, { ...page, priceCents: 39600 }, now);
    assert.equal(result.draft.sourceUrl, vehicleUrl);
    assert.equal(result.draft.priceCents, null);
    assert.equal(result.draft.priceSource, 'manual');
    assert.match(result.message, /full vehicle price/);
    assert.equal(confirmAmazonProduct(result.draft, result.draft.title, 2409400, '', now).priceSource, 'manual');
  }
  for (const changedUrl of ['https://www.amazon.com/dp/B0HK2T5GPL', 'https://www.amazon.com/vindp/B0HK2KTP39']) {
    assert.equal(draftFromAmazonPage(vehicle, { ...page, url: changedUrl }).draft.title, '');
  }
});

test('Short links resolve to Autos and both lookup types pin route and listing across subsequent redirects', async () => {
  const vehicleUrl = 'https://www.amazon.com/vindp/B0HK2T5GPL';
  const vehicle = parseAmazonLink(vehicleUrl).value;
  const short = parseAmazonLink('https://a.co/d/Car123').value;
  const requests = [];
  const page = await fetchAmazonPage(short, async destination => {
    requests.push(destination);
    return destination === short.sourceUrl ? response('', 302, { location: vehicleUrl }) :
      response('<html><head><title>2026 Chevrolet Trax</title></head><body>$396 monthly</body></html>');
  });
  assert.deepEqual(requests, [short.sourceUrl, vehicleUrl]);
  assert.equal(page.priceCents, null);
  assert.equal(draftFromAmazonPage(short, page).draft.sourceUrl, vehicleUrl);
  for (const destination of ['https://www.amazon.com/dp/B0HK2T5GPL', 'https://www.amazon.com/vindp/B0HK2KTP39', short.sourceUrl]) {
    let count = 0;
    await assert.rejects(fetchAmazonPage(vehicle, async () => { count++; return response('', 302, { location: destination }); }));
    assert.equal(count, 1);
  }
  let count = 0;
  await assert.rejects(fetchAmazonPage(short, async () => {
    count++;
    return response('', 302, { location: count === 1 ? vehicleUrl : 'https://www.amazon.com/vindp/B0HK2KTP39' });
  }));
  assert.equal(count, 2);
});


// Minimal markup matching the public cash deal card inspected on the supplied
// /vindp/B0HGBW2WQ3 listing. Finance, tax and fee amounts are deliberately nearby.
const cashCard = (amount = '$24,885', visibleAmount = amount, attributes = '') =>
  `<div data-deal-type="CASH" aria-label="Cash deal" data-vehicle-price="${amount}" ${attributes}><span>Cash</span><span aria-label="${visibleAmount}"><span>${visibleAmount}</span></span><div aria-hidden="true">Listed price excludes government taxes and dealer fees.</div></div>`;
const autoUrl = 'https://www.amazon.com/vindp/B0HGBW2WQ3';
const autoHtml = body => `<html><head><title>Used 2023 Toyota Prius LE</title></head><body>${body}</body></html>`;

test('Observed Autos CASH card fills full vehicle price and confirms with Amazon provenance', () => {
  const page = readAmazonHtml(autoHtml('<div data-deal-type="FINANCE" data-vehicle-price="$483"><span>$483 /mo</span><span>$3,000 down</span></div>' + cashCard() + '<div id="cash-price-breakdown-estimated-order-total">$27,093</div>'), autoUrl);
  assert.equal(page.title, 'Used 2023 Toyota Prius LE');
  assert.equal(page.priceCents, 2488500);
  assert.equal(page.priceKind, 'vehicle-cash');
  assert.equal(page.problem, undefined);
  const result = draftFromAmazonPage(parseAmazonLink(autoUrl).value, page, now);
  assert.equal(result.draft.priceCents, 2488500);
  assert.equal(result.draft.priceSource, 'amazon-page');
  assert.match(result.message, /taxes, dealer fees/);
  const confirmed = confirmAmazonProduct(result.draft, result.draft.title, 2488500, '', now);
  assert.equal(confirmed.priceSource, 'amazon-page');
  assert.equal(createGoalFromInput({ title: confirmed.title, kind: 'item', targetCents: confirmed.priceCents, deadline: null, setAsideRule: { mode: 'fixed', cents: 100 }, product: confirmed }, 0, true, 'auto-goal', now).product.priceCents, 2488500);
});

test('Autos rejects hidden, conflicting, unsupported, mismatched and finance-only cash evidence', () => {
  for (const body of [
    cashCard('$483 /mo'), cashCard('$3,000 down'), cashCard('CA$24,885'), cashCard('$24,885', '$24,000'),
    cashCard('$24,885', '$24,885', 'hidden'), cashCard() + cashCard('$25,000'),
    '<div data-deal-type="FINANCE" aria-label="Finance deal" data-vehicle-price="$24,885"><span aria-label="$24,885">$24,885</span></div>',
    '<span id="cash-header-details-vehicle-price">$24,885</span>',
    '<div data-deal-type="CASH" aria-label="Cash deal" data-vehicle-price="$24,885"><span aria-label="$24,885" aria-hidden="true">$24,885</span></div>',
  ]) assert.equal(readAmazonHtml(autoHtml(body), autoUrl).priceCents, null, body);
  const page = readAmazonHtml(autoHtml(cashCard()), autoUrl);
  assert.equal(draftFromAmazonPage(parseAmazonLink(autoUrl).value, { ...page, priceKind: undefined }).draft.priceCents, null);
  assert.equal(readAmazonHtml(autoHtml('<input id="ASIN" value="B0WRONG123">' + cashCard()), autoUrl).priceCents, null);
});

test('Mobile full-price offer survives a separate financing widget and ignores per-unit and used accordion amounts', () => {
  const page = readAmazonHtml(html('<div id="corePrice_mobile_feature_div">' + price('$79.99') + '<div class="installment-widget">' + price('$6.67') + ' per month</div><span class="pricePerUnit">' + price('$0.20') + ' /ounce</span></div><div data-csa-c-buying-option-type="USED"><div id="corePrice_feature_div">' + price('$39.99') + '</div></div>'), url);
  assert.equal(page.priceCents, 7999);
  const used = readAmazonHtml(html('<div id="apex_desktop_usedAccordionRow"><div id="corePrice_feature_div">' + price('$39.99') + '</div></div>'), url);
  assert.equal(used.priceCents, null);
});


test('Nested full-price qualifiers remain disqualifying across block and inline elements', () => {
  for (const tag of ['div', 'section', 'span']) {
    for (const qualifier of ['per month for 12 months', 'Starting at', 'From', ' - $19.99']) {
      for (const body of [price('$9.99') + `<${tag}>${qualifier}</${tag}>`, `<${tag}>${qualifier}</${tag}>` + price('$9.99')]) {
        assert.equal(readAmazonHtml(html(core(body)), url).priceCents, null, body);
      }
    }
  }
});
