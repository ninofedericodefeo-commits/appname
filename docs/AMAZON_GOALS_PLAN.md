# Amazon links → savings goals

Status: automatic name and USD price lookup implemented October 10, 2026. No paid service or Amazon credentials are required. Amazon Autos VIN detail links are supported as of October 18, 2026. Product images remain future work.

## Available now

In **Goals → Goal from Amazon link**, paste or type an HTTPS `amazon.com` product link or `a.co` short link. **Paste link** reads the clipboard after a tap and starts lookup; **Get product details** starts lookup for typed links. Retail product URLs normalize to `/dp/<ASIN>`; Amazon Autos links normalize to `/vindp/<listing-ASIN>`, preserving the vehicle listing. Tracking parameters are discarded. Short links resolve only to supported HTTPS Amazon product or vehicle destinations.

For retail products, lookup fills the name, selected variant when available, and one clear full USD offer price. The editable preview labels imported prices **Price from Amazon** and records when they were read. Tax, shipping, coupons and monthly payments are excluded. Conflicting prices, ranges, unavailable items, other currencies, sign-in, CAPTCHA, offline errors and Amazon service errors keep the price blank; readable names remain filled in. Retry, change the link, enter details manually, or cancel a pending lookup. Late responses cannot overwrite another draft.

For Amazon Autos, lookup fills the vehicle name and cash vehicle price when the public page exposes one unambiguous Cash deal card. The card must identify itself as CASH, carry a valid USD vehicle amount, and show the same visible amount. Finance, lease, monthly, down-payment, MSRP and unrelated amounts cannot supply the target. The preview explains that taxes, dealer fees and checkout costs may be extra. If cash evidence is absent, hidden, conflicting or unreadable, enter the full vehicle target manually. A vehicle source remains a normal backwards-compatible product goal with its VIN detail source URL, listing ASIN and Amazon/manual price provenance.

The existing deadline, fixed/percent/round-up rule and Assign none/Assign all controls remain in the shared editor. **Create goal** confirms the reviewed values. An active goal requires editing or confirmed archive first. Cancellation does not change the pocket or saved goals. Metadata persists with active and archived goals; target edits preserve saved money and purchase history. Editing an imported price or selected variant changes its provenance to manual. Automatic lookup never changes a saved goal's target.

## Implementation

- Native: a temporary, noninteractive, incognito `react-native-webview` reads the rendered public product page. Its bridge accepts only validated product data. No account cookies are shared. Navigation is restricted to supported retail/vehicle/short URLs. Once a short URL resolves, both the listing route type and ASIN are pinned; navigation to another listing or from `/vindp` to `/dp` is rejected. The view disappears after lookup and has a 20-second timeout. The existing WebView dependency is already SDK-compatible; no new native module was added.
- Web: `/api/amazon-product` fetches public HTML on the server. Client lookup is cancelled on draft changes/unmount. `web.output` is `server`, so production web hosting must deploy the exported server as well as client assets (EAS Hosting or another compatible host). Native lookup does not require this backend.
- Server fetches use an explicit GasFinder user agent, a 15-second timeout, at most four redirects, a 3 MB response limit and eight concurrent requests per server instance. Every destination is checked before requesting it; unsupported hosts, protocols, ports, logins, listing-type changes and ASIN changes are rejected, including after the first short-link resolution. Responses are not cached.
- `amazonReaderScript.ts` contains the shared DOM reader as static source, because Hermes does not preserve function source. The server parses HTML with LinkeDOM and evaluates only this app-owned reader. Remote scripts are never executed on the server. Native JavaScript reads only the main frame.
- Selected-offer DOM containers take priority. Mobile core-price containers are supported, and a separate installment widget does not invalidate a readable full price. Used accordions and per-unit amounts are excluded. Structured metadata is a retail-only fallback for this ASIN and a single current USD Offer. Related products, crossed-out/list prices, aggregate offers, coupons and installments cannot supply a target. Autos reads only the observed `[data-deal-type="CASH"][aria-label="Cash deal"]` card with matching visible price evidence; it never reads arbitrary page dollar amounts or hidden pricing breakdowns.
- Product data is validated before becoming a draft; it cannot trigger a purchase or goal creation. Only explicit confirmation persists it. USD prices are stored in integer cents.

## Verification and limits

Lint and TypeScript pass; 91 logic tests pass, including nine lookup tests for offer parsing, partial results, currency/provenance, redirect validation, bounded responses and aborts. Native iOS/Android Hermes exports and web server export pass.

The live server check on October 10 returned an Amazon service error, and the app correctly showed a retry/manual fallback. Successful autofill is verified with representative HTML fixtures, not a claim that every live page is accessible. Mobile-width browser checks use an isolated localhost origin and a temporary test proxy around the exported API handler, with synthetic product data. These checks verified short-link autofill, name-only fallback, pending cancellation followed by another lookup, confirmed creation and restart persistence. No fixtures or test endpoints are shipped. Confirm real direct and short links on physical iPhone and Android before treating live extraction as reliable.

Amazon can change markup or refuse access. Do not bypass login, CAPTCHA or access restrictions. If a supported page consistently refuses public access, an eligible official [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) integration or an explicitly shared page helper may be needed for more reliable access.

## Device acceptance checks

- Direct and short links: name/selected variant/full price match the public Amazon page, including sale versus list price.
- Never use a coupon, monthly payment, range, “from” price or non-USD amount as a savings target.
- Test partial name-only results, unavailable pages, blocked/offline access, retry and manual fallback.
- Cancel lookup, change its URL and leave the screen while pending; no late result or pocket mutation.
- Create and restart; verify persisted name, target, source and provenance. Edit the target and confirm saved money stays unchanged.
- Clipboard permission denial, manual paste recovery, Amazon app/browser handoff, keyboard, small screens, large text and VoiceOver/TalkBack.

## Autos verification — October 18, 2026

Read-only inspection of the live first-party [Autos storefront](https://www.amazon.com/autos) followed its **Browse cars now** control to vehicle search, then a specific listing to [New 2026 Chevrolet Trax FWD LS](https://www.amazon.com/vindp/B0HK2T5GPL). Its actual route was `/vindp/B0HK2T5GPL/ref=sr_1_1?...`, not `/dp/...`. The detail page showed a name in its document title, finance and lease monthly payments, a down payment, cash price, rebates, fees and a separate finance summary. No sign-in or purchase action was taken. This verifies the supported route and the need for explicit price review; it does not promise ongoing inventory availability or successful automated reading of every native page.

The current Autos parser accepts the observed exact `/vindp/<10-alphanumeric-listing-ASIN>` route with optional Amazon `ref=` path suffix. It does not accept Autos browse/search pages or invent additional unverified route patterns. Normal `/dp` products and `a.co` short links continue to work. Amazon regression tests cover route preservation, short-link resolution, subsequent redirect identity checks, host/credential/port rejection, vehicle-name extraction and refusal to import vehicle prices without cash-card evidence, even from bridge data that claims to contain an amount. Physical iPhone/Android share-sheet and live WebView acceptance remain required.


## Price lookup follow-up — October 18, 2026

The user-supplied [Used 2023 Toyota Prius LE](https://www.amazon.com/vindp/B0HGBW2WQ3) was inspected read-only in the in-app browser. It showed a Cash deal of **$24,885**, a separate **$483/month** finance offer and **$3,000** down payment. The visible cash card supplied `data-deal-type="CASH"`, `data-vehicle-price="$24,885"`, `aria-label="Cash deal"` and a matching visible price label. That exact DOM contract now supports automatic cash-price drafts. The hidden estimated order total of $27,093 was deliberately excluded. A dedicated regression verifies cash provenance survives explicit goal confirmation, while monthly/foreign/hidden/conflicting/mismatched evidence stays manual.

A public retail AirPods page (`/dp/B0D1XD1ZV3`) returned its product title but no current new-item price; its separate used-only offer correctly remained excluded. An end-to-end localhost web check pasted the actual vehicle name plus the supplied link, normalized it to the VIN detail URL, and filled **Used 2023 Toyota Prius LE**, **24885.00**, **Price from Amazon** and the cash-price/taxes-and-fees review notice. No goal was saved. An earlier direct server request to the same Autos listing returned an Amazon service page. Consequently, browser/native and server results can differ: automatic lookup is attempted, but readable public pricing cannot be guaranteed when Amazon refuses access or requires cart/sign-in. No cart, login, purchase, CAPTCHA or access-bypass action was taken.

Fifteen focused lookup tests pass, including the mobile full-price plus separate-financing layout, used-accordion and unit-price exclusions, block/inline-wrapped installment/from/range rejection, observed Autos cash-card markup, unsafe vehicle-price rejection and explicit confirmation. Physical iPhone/Android acceptance remains outstanding.

Final integrated checks: 350 logic tests, Expo lint, TypeScript and iOS/Android/web JavaScript exports pass. The input and price preview were inspected in light and dark themes at 320 and 1024 CSS pixels on web; temporary appearance changes were restored. No physical-device check was performed.
