# Amazon links → savings goals

Status: automatic name and USD price lookup implemented October 10, 2026. No paid service or Amazon credentials are required. Product images and the optional Safari helper remain future work.

## Available now

In **Goals → Goal from Amazon link**, paste or type an HTTPS `amazon.com` product link or `a.co` short link. **Paste link** reads the clipboard after a tap and starts lookup; **Get product details** starts lookup for typed links. Direct product URLs normalize to `/dp/<ASIN>` and tracking parameters are discarded. Short links resolve only to supported HTTPS Amazon product destinations.

Lookup fills the name, selected variant when available, and one clear full USD offer price. The editable preview labels imported prices **Price from Amazon** and records when they were read. Tax, shipping, coupons and monthly payments are excluded. Conflicting prices, ranges, unavailable items, other currencies, sign-in, CAPTCHA, offline errors and Amazon service errors keep the price blank; readable names remain filled in. Retry, change the link, enter details manually, or cancel a pending lookup. Late responses cannot overwrite another draft.

The existing deadline, fixed/percent/round-up rule and Assign none/Assign all controls remain in the shared editor. **Create goal** confirms the reviewed values. An active goal requires editing or confirmed archive first. Cancellation does not change the pocket or saved goals. Metadata persists with active and archived goals; target edits preserve saved money and purchase history. Editing an imported price or selected variant changes its provenance to manual. Automatic lookup never changes a saved goal's target.

## Implementation

- Native: a temporary, noninteractive, incognito `react-native-webview` reads the rendered public product page. Its bridge accepts only validated product data. No account cookies are shared. Navigation is restricted to supported product/short URLs with matching ASINs. The view disappears after lookup and has a 20-second timeout. The existing WebView dependency is already SDK-compatible; no new native module was added.
- Web: `/api/amazon-product` fetches public HTML on the server. Client lookup is cancelled on draft changes/unmount. `web.output` is `server`, so production web hosting must deploy the exported server as well as client assets (EAS Hosting or another compatible host). Native lookup does not require this backend.
- Server fetches use an explicit GasFinder user agent, a 15-second timeout, at most four redirects, a 3 MB response limit and eight concurrent requests per server instance. Every destination is checked before requesting it; unsupported hosts, protocols, ports, logins and ASIN changes are rejected. Responses are not cached.
- `amazonReaderScript.ts` contains the shared DOM reader as static source, because Hermes does not preserve function source. The server parses HTML with LinkeDOM and evaluates only this app-owned reader. Remote scripts are never executed on the server. Native JavaScript reads only the main frame.
- Selected-offer DOM containers take priority. Structured metadata is a fallback only for this ASIN and a single current USD Offer. Related products, crossed-out/list prices, aggregate offers, coupons, used-only sections and installments cannot supply a target.
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
