# GasFinder project handoff

Use this file as the context for a fresh chat; the earlier chat history is not needed for normal project work. This summary does not delete messages from Codex.

## Project and working rules

- Workspace: `/Users/nino/Documents/appname`; repository: `ninofedericodefeo-commits/appname`; current branch: `agents/enable-online-functionality`.
- Expo SDK 57, React Native 0.86, React 19.2, Expo Router, TypeScript, Zustand + AsyncStorage. npm/package-lock; use `npx`, not Bun.
- Read `AGENTS.md`. Fetch SDK-matched Expo docs before changing Expo/RN APIs. Run Expo lint, TypeScript and relevant logic tests. Commit and push coding changes each turn.
- Keep native changes in app config/plugins; generated native directories are ignored. A free Apple Personal Team is the default. Push Notifications, App Groups, widgets and the iOS receive-share extension remain opt-in with `EXPO_ENABLE_IOS_CAPABILITIES=1` for an enrolled team.
- No agents/delegation unless explicitly requested. Preserve existing user work.

## Product decisions

- One user for now. Personal data remains local; no bank/card connection, account synchronization, real money transfers, custody, stock purchases or brokerage integration. Pocket values are estimates of money still in the user's account. USD only.
- Four bottom tabs, with stable tab transitions: Gas; Goals with Activity on the same page; Pocket; Subs with Spending Pause on the same page. No More tab or separate embedded subpages.
- Style: cream paper, dark green, restrained rust/lime accents, simple mobile layouts, readable values and familiar icon actions. Avoid numbered dashboard sections and verbose goal copy.

## Implemented features

- Gas defaults to map, with a list alternative. GPS starts nearby OpenStreetMap station discovery on launch; stations render progressively. No paid map key is required. Missing names say Name not listed; missing prices use a clearly labeled fictional $9.99 example, excluded from cheapest-price ranking.
- Gas receipt reports and direct price reports belong to Gas. Local reports link prices and their history graph to locations. GPS can supply approximate place details; maps open the station's actual coordinates.
- Gas on your drive takes a destination entered/shared/pasted into the app, estimates fuel needs with saved car profiles, MPG/tank capacity, and fuel amount or percentage. It plans multiple refills for long trips. A saved refill threshold and Apple/Google Maps preference control planning and route handoff. The app cannot read another map app's current destination silently. Service failures have fallback/retry handling, not fake successful plans.
- Savings supports one active goal, optional calendar deadline, fixed/percent/round-up rule, editable limits, all-or-none starting pocket assignment, goal editing/deletion, archives, release/lower-pocket inside Edit goal, and manual set-aside/purchase forms inside Edit goal. Existing simulated investing records stay read-only and never count as savings. Editing/deleting a purchase does not release its set-aside.
- The goal card uses icon actions in the upper right, a compact `$saved / $target` value with commas, and a progress bar. Remaining money appears only when the total is tapped. The header has Activity and Settings icons. Empty Activity keeps purchase/pocket-change sections with labels and placeholders, without fabricated transactions.
- Apple Pay: a signed bundled GasFinder Log Purchase shortcut extracts Amount, Merchant and Currency Code. The import link validates USD and deduplicates repeat opens, then applies the active rule. The setup guide saves its step and opens the named shortcut on iOS 27, with earlier-iOS instructions. Apple still requires card/Transaction-trigger setup. Returning from Shortcuts starts checking, not a claim that automation is enabled; only a new shortcut import confirms receipt of a purchase. Actual Wallet taps need physical-phone testing.
- Bank CSV fallback: Activity's upload icon opens `/bank-import`. Choose a file or paste CSV, review column mapping/date order/spending direction, select spending transactions, review possible matches and optionally apply the goal rule. Import retains purchase dates and source labels, caps set-asides, and deduplicates repeated/overlapping imports, including deleted imported records. Known credits, refunds, transfers, pending rows and non-USD rows are excluded. Raw files are not persisted or sent to a server. Account balances remain manually reported. Native file picking uses expo-document-picker and needs a rebuilt development app; pasting works in existing builds.
- Amazon product goals: Goals → Goal from Amazon link opens `/amazon-goal`. Explicit paste or Get product details retrieves the name, selected variant and full USD price from supported public Amazon pages, resolving a.co links. Native uses an incognito temporary WebView; web uses the Expo API route `/api/amazon-product` (deploy the server output for production web). Values remain editable and require confirmed creation. Blocked, unavailable, ambiguous or non-USD offers retain any readable name and offer retry/manual entry. Imported prices carry read timestamps and Amazon provenance; edited prices/variants become manual. Existing active-goal, archive and pocket assignment rules remain. Images and the Safari helper remain planned. Live server access returned an Amazon service error; physical phone success still needs verification.
- Subs supports monthly/yearly renewals, day-before review, local reminder notifications and cancellation notes. Spending Pause offers logging the actual bought amount once.

## Important code and docs

- Goals/Activity: `src/app/(tabs)/investment.tsx`, `src/features/goals/GoalsPanel.tsx`, `GoalProgressCard.tsx`, `src/features/pocket/ActivityPanel.tsx`, `src/stores/pocketStore.ts`.
- Purchase setup: `src/app/purchase-automation.tsx`, `src/app/import-purchase.tsx`, `docs/PURCHASE_SHORTCUT.md`, `assets/shortcuts/*`, `scripts/sign-purchase-shortcut.py`.
- Bank import: `src/app/bank-import.tsx`, `src/features/bank/*`, `docs/BANK_IMPORT.md`.
- Amazon goals: `src/app/amazon-goal.tsx`, `src/features/goals/amazonLink.ts`, `AmazonProductLookup.tsx`/`.web.tsx`, `amazonReaderScript.ts`, `amazonLookup.server.ts`, shared `GoalEditor.tsx`, and `docs/AMAZON_GOALS_PLAN.md`.
- Read feature docs in `docs/` and `docs/PHONE_SMOKE_TEST.md` for remaining device gates.

## Running and verification

- `npx expo start --host lan` starts Metro for the phone. `npx expo run:ios --device` builds/installs a development app after native dependency changes. Existing docs explain Personal Team capability configuration; avoid enabling App Groups or Push Notifications on that team.
- Required checks: `npx expo lint`, `npx tsc --noEmit`, `npm run test:logic`. Native JS/Hermes exports and mobile-width browser checks complement these, but do not prove real iPhone Wallet/file-picker behavior.
- Latest verification (October 10, 2026): lint and TypeScript pass; 91 logic tests pass; iOS/Android Hermes and web server exports pass. Automatic lookup parsing uses representative fixtures; the live Amazon server check returned a service error and correctly offered fallback. Successful autofill is checked at mobile width with synthetic data through the exported API handler. Browser checks at phone width verified collapsed/tapped goal values, edit/delete controls, empty Activity, CSV file selection and paste, column selection, possible-match review, exact optional rule accounting and repeat-import prevention. Amazon checks at 390 px additionally verified direct/short links, invalid hosts, draft cancellation, creation, restart persistence, variant/target edits, active-goal blocking, archive confirmation and both pocket assignment choices. Only synthetic data was used.
- Next physical tests: live Amazon direct/short-link name and full-price extraction, blocked/partial fallback, cancellation, clipboard denial/paste recovery, product-link app/browser handoff and keyboard/accessibility; bank file selection/cancellation and CSV import; goal icon accessibility/large text, tap-to-reveal remaining value, empty Activity, Apple Pay shortcut import and real Transaction trigger, maps/route handoff on both platforms.
