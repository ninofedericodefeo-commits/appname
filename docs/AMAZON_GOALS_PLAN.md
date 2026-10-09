# Amazon links → savings goals

Status: planned, not implemented. Keep the app local and avoid paid API dependencies.

## User flow

1. Copy an Amazon product link and tap **Goal from link** in Goals. Read the clipboard only after the tap; also allow pasting a URL.
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

1. Add a local product-goal draft model (`sourceUrl`, `asin`, `title`, `variant`, `currency`, `priceCents`, `priceReadAt`, `priceSource`) and a pure URL validator/parser.
2. Add paste/preview/confirm, loading/error states and manual fallback. Support USD first; explain unsupported currencies instead of guessing conversions.
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
