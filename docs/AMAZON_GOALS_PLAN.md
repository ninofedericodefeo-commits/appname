# Amazon links → savings goals

Status: the initial local flow is implemented (October 9, 2026). Automatic product/price/image extraction and the optional Safari helper remain planned. No paid API dependency is used.

## Available now

In **Goals → Goal from Amazon link**, paste or type an HTTPS `amazon.com` product link or `a.co` short link, then review it. **Paste link** reads the clipboard only after a tap. Direct product links are normalized to `/dp/<ASIN>` and tracking parameters are removed. Short links are retained without fetching or resolving redirects.

Enter the product name, optional variant and full USD price in the shared goal editor. The preview updates with these entries. Tax and shipping are included only if the user adds them to the entered target. Product names, prices and images are not automatically retrieved; open the source link to check the selected offer. The flow works offline after the link is pasted, including manual entry and confirmation.

Choose the existing deadline and fixed/percent/round-up controls, then explicitly **Create goal**. Assign none is the default for existing pocket money; Assign all uses the existing amount without increasing the pocket. With an active goal, the flow offers editing it or finishing and archiving it with confirmation before creating another. Canceling a draft does not change goals or the pocket.

The product source URL, ASIN when available, title, variant, USD target, entry timestamp and manual provenance are stored with the goal and retained in its archive. **View on Amazon** opens the source from the active goal card. Editing its target or variant requires Save goal and preserves saved money and purchase history. Existing goals without product metadata continue to use the same editor.

Verification: six Amazon logic tests cover URL normalization/rejection, unresolved short links, exact cents, USD validation, all-or-none assignment and target edits preserving saved money. Browser checks at 390 px verified invalid links, direct/short links, draft cancellation, creation, restart persistence, variant/target edits, active-goal blocking, confirmed archive and both starting-assignment choices using synthetic data. Physical iPhone/Android clipboard, keyboard, accessibility and Amazon-app/browser handoff still need device testing.

## User flow

1. Copy an Amazon product link and tap **Goal from Amazon link** in Goals. Tap **Paste link** to read the clipboard; also allow typing/pasting a URL.
2. Show a product preview: title, selected variant, image when available, USD price, source link and when the price was read. Explain whether tax and shipping are included. Never interpret a monthly payment, coupon or “from” price as the selected item's full price.
3. Allow editing the title and target, choosing a deadline and a fixed/percent/round-up rule. Reuse the existing goal editor and calendar.
4. Tap **Create goal** to confirm. If a goal is already active, offer to edit that goal or finish it first; never silently replace it or assign pocket money.
5. Save the confirmed product details with the goal on the device. Subsequent price changes require confirmation before changing the target. Saved progress and past purchases stay unchanged.

## Price lookup without a paid service

- A URL alone does not guarantee access to Amazon's current product price. First implement URL validation, a preview and a manual price fallback. Missing information stays blank, with “Enter the price you see on Amazon.”
- Explore an optional Safari shortcut that reads the product page the user has opened and explicitly shared. Prefer structured product metadata, then a clearly identified selected offer. Send title, URL, currency and price to a draft goal link, not directly to goal creation. A copied Amazon-app link may not carry page contents, so it still needs a fallback.
- Do not bypass login, CAPTCHA or access restrictions. Bound permitted page fetches by time, size and redirects. Support canonical `amazon.com/dp/<ASIN>` URLs and `a.co` short links first, validating HTTPS and the actual hostname after each redirect; reject deceptive subdomains and local/private network destinations.
- Amazon's official [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) is a later option, subject to [accepted Associates membership](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/onboarding/register-for-creators-api), marketplace eligibility and permitted use. Do not assume it is available to a personal, local savings app. Credentials would require a secured backend, outside the current scope.

## Implementation order

1. **Done:** local product-goal draft model (`sourceUrl`, `asin`, `title`, `variant`, `currency`, `priceCents`, `priceReadAt`, `priceSource`) and a pure URL validator/parser.
2. **Done:** paste/preview/confirm, clipboard/hydration loading and error states, and manual entry. USD only.
3. Build and verify the optional Safari helper on an iPhone. Keep parsed values editable and validate incoming data before opening the draft.
4. Test real product pages and short links before enabling automatic extraction. If reliable permitted access needs an account/provider, keep manual confirmation available and revisit that integration separately.

## Acceptance checks

- Valid direct/short URLs, invalid hosts, redirect failures, unavailable/offline pages and missing prices.
- Variants, sale/list prices, coupons, installments, ranges and non-USD prices never create the wrong target.
- Product text is treated as data; it cannot trigger purchases, network access or app actions.
- Clipboard access is explicit. Cancellation leaves goals and pocket totals unchanged.
- Confirmation preserves the one-active-goal rule and existing all-or-none starting assignment.
- Large prices display commas and retain exact cents; editing a product price does not change saved money.
- Android has the same paste/manual goal flow; Safari extraction is optional on iPhone.
