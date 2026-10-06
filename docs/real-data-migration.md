# Real-data migration map

## Scope and guardrails

This app is intended to be private and single-user. The planned default is local-first storage for personal and financial data. The current app includes grouped Gas, Savings, Money, and Activity navigation, receipt and price reports, route fuel suggestions, bank-history CSV import, and recurring-charge suggestions. This document maps those features to their intended data sources.

Local station fixtures in `src/features/stations/mockData.ts` are used only in the explicit sample/demo mode when no sample API is configured. Do not remove them until each feature has a mapped and validated replacement, including tests and failure behavior. Sample, user-reported, cached, and provider-backed prices must remain distinguishable and must not be presented as verified real-time results.

No bank connection, FinanceKit integration, shared account, or financial-data backend is assumed. Transaction history is imported from files explicitly selected by the user and processed on-device. The current station implementation has sample, OpenStreetMap, and Google Places service modes; provider availability and production suitability still need validation. The Gas screen now opens in sample mode and does not request location until the user chooses a location-based search.

## Current implementation inventory

| Area | Current implementation | Source classification | Gap before real data |
| --- | --- | --- | --- |
| Station list and prices | `src/features/stations/data.ts` and `hooks.ts`; explicit sample mode plus OpenStreetMap/local service and Google Places service modes | Local sample fixtures, local station service, or configured provider | Validate service configuration, provider terms, coverage, freshness, offline behavior, and price provenance. Retain fixtures for sample mode and deterministic tests. |
| Device location | `src/features/location/permissions.ts`; Gas screen requests foreground permission only when switching to nearby/online search | Device-provided | Demo mode is the initial mode and does not require location permission. Define denied, unavailable, timeout, retry, and optional user-entered location behavior for location-dependent modes. |
| Radius and sort | Zustand settings store; station preparation in `src/features/stations/logic.ts` | User preference plus derived filtering/order | Verify distance calculation, radius inclusivity, and missing-price behavior against tests and each source. |
| Fuel selection | Zustand settings store; station price lookup and normalization in station features | User preference plus provider price data | Map provider fuel-grade names and unavailable grades to the app's domain type. |
| Station freshness/provenance | `reportedAt`, `source`, and provider attribution in station domain records | Sample, community-reported, cached, or provider metadata | Define provider timestamp semantics, stale thresholds, attribution, and UI display; do not equate sample/community records with verified prices. |
| Savings goals and pocket | `src/app/(tabs)/investment.tsx`, `pocket.tsx`; `src/features/goals/`, `investing/`, `pocket/`; Zustand stores | Locally persisted user-entered data | Verify persistence, edits/deletion, schema migration, currency/rounding, and export/recovery behavior. These are not linked account balances. |
| Spending pause and subscriptions | `src/app/(tabs)/spending.tsx`, `subscriptions.tsx`; `src/features/subscriptions/`, local stores and reminder logic | User-entered rules and subscription records | Verify persistence and notification behavior; no bank-derived transaction history is assumed. |
| Activity, receipt reporting, price history | `src/app/(tabs)/activity.tsx`, `src/app/report-receipt.tsx`, `src/app/price-history.tsx`; receipt and station history features | Locally stored user reports and derived history | Document event coverage, retention, deletion/export, evidence, and the distinction between user reports and provider data. |
| CSV import and recurring suggestions | `src/components/BankHistoryPanel.tsx`, `src/features/bankHistory/logic.ts`, and `src/stores/bankHistoryStore.ts` | User-selected CSV, previewed and confirmed before local persistence; fictional sample history is separately labeled | Broaden format and row-level review, validate duplicate/failure/recovery behavior, define export/deletion, and test false-positive handling. |
| Settings, search, directions, station details | Gas screen has mode controls and direction actions; no dedicated manual-location route was found | User action and platform links | Verify each action and map any remaining gaps to a route or platform-safe operation. |

## App-integrated delivery plan

The migration work should land through the app's real feature and route structure, not as a disconnected data layer or an informational plan screen. The current app has grouped routes in `src/app/(tabs)/` for Gas, Savings, Money, and Activity, with nested/secondary screens for receipts, price history, route fuel, and purchase automation. Feature logic and local stores exist under `src/features/` and `src/stores/`, including bank-history CSV parsing and persistence.

### Route and module map

| User surface | Planned route location | Data/module boundary | Status |
| --- | --- | --- | --- |
| Gas station list and filters | `src/app/(tabs)/index.tsx` Gas tab | `src/features/stations/` data service, logic, types, query hooks, OpenStreetMap search, local reported prices, and retained mock fixture; `src/features/location/` provides optional location permission/current position | Existing UI; starts in sample mode without requiring location; local fixtures are an explicit sample-mode source when no sample API is configured; nearby search is opt-in |
| Station details and directions | Gas cards/actions and `src/app/price-history.tsx` | Reuse station/history features and platform-safe map links | Partially implemented; verify all route/action behavior |
| Savings goals and pocket | `src/app/(tabs)/investment.tsx` and `src/app/(tabs)/pocket.tsx`; Pocket is a secondary Savings route | `src/features/goals/`, `src/features/investing/`, `src/features/pocket/`, persisted stores | Implemented local workflows; validate storage/export/deletion lifecycle |
| Spending pause and subscriptions | `src/app/(tabs)/spending.tsx` and `src/app/(tabs)/subscriptions.tsx`; Spending Pause is a secondary Money route | Subscription logic/reminders and persisted stores | Implemented as user-managed data; bank CSV is separately imported on-device |
| CSV import and recurring review | Bank-history panel inside the Money tab's subscriptions screen | `src/features/bankHistory/logic.ts`, `src/stores/bankHistoryStore.ts`, and `src/components/BankHistoryPanel.tsx` | Preview/confirm-before-persist and evidence-based dismiss/restore exist; validate format coverage, corrections, and data lifecycle |
| Activity | `src/app/(tabs)/activity.tsx` | Current local activity records; define event coverage/retention before expanding | Existing screen; assess completeness |
| Settings and data management | Root Stack/app actions; add a route only if needed for export/deletion/preferences | Existing settings store plus feature repositories | Audit data management and remaining inactive actions |

Keep all non-screen logic outside `src/app/`. The grouped tab shell is implemented; preserve its existing routes and tab mapping as real features are integrated. Keep CSV import in its current Money-tab flow unless later UX work calls for a dedicated review route; do not imply unsupported bank linking or live account data.

### Sequenced increments tied to the codebase

1. **Gas baseline and source contract**
   - Work in `src/types/stations.ts`, `src/features/stations/hooks.ts`, `src/features/stations/mockData.ts`, and the Gas screen/card.
   - Specify provider-independent station/price types, provenance/freshness semantics, radius filtering, missing-grade behavior, deterministic price-vs-distance sorting, and empty/error/loading states.
   - Keep the explicit sample path and fixtures intact and visibly sample-labeled. Add contract tests before provider integration.
   - Exit gate: current screen behavior is covered by tests, and the provider decision has passed the U.S. coverage, terms, billing, and credential checks above.

2. **Repository and provider boundary**
   - Refactor station fetching behind a repository in `src/features/stations/`; the query hook calls that boundary rather than importing `mockData.ts` directly.
   - Keep explicit mock and real implementations. Select the implementation through development/test configuration, not silent live-request fallbacks.
   - Wire provider-derived attribution and updated-at fields into `GasStationCard`; implement retry/error behavior without marking stale or fixture values as live.
   - Exit gate: adapter contract tests, query tests, and a U.S. device/simulator smoke test pass; mocks still run in tests.

3. **Verify the grouped app navigation**
   - Preserve the existing Expo Router tabs for Gas, Savings, Money, and Activity, plus secondary routes for receipts, history, route fuel, and purchase automation.
   - Keep route files in `src/app/` and feature components, hooks, repositories, and domain logic outside it.
   - Add navigation tests/smoke checks for route access, deep links, back behavior, and small-screen layout; do not combine navigation changes with provider-specific data transformations.

4. **Local persistence and Savings**
   - Define schemas and migration/export/delete behavior before selecting/installing storage. Review Expo SDK 57-compatible storage options when implementation begins.
   - Audit and extend the existing goal, investing, and pocket logic/stores instead of creating duplicate feature modules; keep balances user-entered/derived, not linked-account values.
   - Exit gate: create/edit/delete, persistence across restart, schema migration, and export/deletion behavior are tested for the existing routes.

5. **Harden transactions, CSV, Money, and Activity**
   - Audit the on-device CSV importer, parser, bank-history store, and subscription suggestions. The Money panel now performs select → parse/validate → preview → deduplicate → confirm → persist, with cancellation and recoverable errors; extend it with representative bank formats and finer-grained invalid-row review.
   - Keep raw rows separate from normalized transactions; store only needed import metadata and avoid uploading selected file contents.
   - Keep recurring candidates reviewable and distinct from confirmed subscription records. The current UI shows occurrence count, amount range, interval, and an early/repeated evidence tier, and persists dismiss/restore decisions; test false positives and user corrections.
   - Verify Activity coverage, retention, and deletion/export policy for imported data.
   - Exit gate: representative bank CSV fixtures, malformed/duplicate/canceled imports, candidate false-positive review, app restart, and local deletion/export are tested.

6. **Complete route coverage and retire mocks deliberately**
   - Audit the existing Savings/Money/Activity and CSV-import routes; incomplete actions must not look functional.
   - Audit all screens, hooks, and tests for fixture-vs-live labeling and failure behavior.
   - Remove a production mock default only through a separately reviewed change after the mock-retirement gate below; retain fixture records/adapters for deterministic development and tests.

## Planned feature source map

| Feature | Authoritative input | Local app data | Derived data and contract work |
| --- | --- | --- | --- |
| Gas discovery | Selected location from device or user search; station and price records from a vetted provider | Search and display preferences | Normalize provider records to domain models; calculate distance; filter by radius; sort by selected fuel or distance; preserve provider timestamps and attribution. Do not use fixture values as live fallback. |
| Savings — Goals | User-entered goal details and contributions | Goal identity, name, target, target date, contributions, and edits | Progress is calculated from contributions against the target; document currency, rounding, validation, and deletion behavior. |
| Savings — Pocket | User-entered pocket details and balance activity | Pocket identity, name, entries, and any manually maintained balance | Define whether displayed balances are manually maintained or derived from entries; do not imply a linked financial account or verified bank balance. |
| Money — Spending pause | User-configured rules and applicable local activity/transactions | Pause duration, categories, thresholds, overrides, and state | Define eligible activity, time-zone/calendar semantics, rule precedence, and whether alerts/notifications are in scope. |
| Money — Subscriptions | Transactions imported from a user-selected CSV | Imported transaction records, user-confirmed subscriptions, edits, dismissals | Generate reviewable candidates from normalized merchant/date/amount history. Keep confidence, evidence, and user overrides separate from confirmed subscription records. |
| Activity | Local user actions and imported-record events | Event history and import status | Define event taxonomy, retention, ordering, privacy, and whether imported transactions appear in the activity feed. Avoid collecting unrelated telemetry. |
| CSV import | CSV file explicitly chosen by the user | Import profile/mapping and normalized transactions | Define encoding/header mapping, date and decimal formats, currency, duplicate handling, malformed-row preview, cancellation, atomic commit/rollback, and safe deletion/export. Process on-device by default. |

## Domain and source boundaries

- UI components consume app-owned domain types, never raw provider responses or raw CSV rows.
- Each record should carry only the provenance needed to explain its origin: provider and provider update time for station prices; import batch/source file metadata for imported transactions; user-entered status for manual records; and derivation evidence for subscription candidates.
- Represent freshness separately from origin. A provider response is not necessarily current, and an imported transaction is not a live account balance.
- Keep source selection explicit. A development/test fixture adapter is acceptable; an unavailable provider must produce an explicit loading/error/empty state rather than a success-shaped fixture fallback.
- Validate all external input at the adapter boundary. Keep financial transactions and import file contents on-device unless a later, explicit user decision changes the privacy model.
- Do not put a private provider secret in the mobile application bundle. Evaluate whether the selected provider supports a restricted public client key or requires a narrowly scoped proxy before implementation.

## Gas provider decision

**Status: initial research complete; production provider not selected.** As of October 6, 2026, Google Places is the clearest self-service candidate to test, not an approved source. The reviewed public docs do not establish station/grade completeness or a freshness SLA, and the billable field tier for fuel-price requests needs confirmation.

### Initial provider comparison

| Candidate | Fit | Limits and follow-up |
| --- | --- | --- |
| Google Places API (New) | Station search plus per-grade fuel options and update timestamps are documented. Pay-as-you-go API with quotas and key restrictions. | Test representative urban and rural coverage and actual timestamp age. Confirm which SKU `fuelOptions` triggers, applicable caching/display and attribution rules, and whether the private app distribution/use fits the applicable terms. Restricted app keys can still be extracted; they are not secrets. |
| GasBuddy | Public company materials state a large North American price network. | Public materials reviewed do not establish API access, licensing for reuse, app pricing, price-level coverage, or a freshness commitment. Contact the provider for terms and a quote; do not reuse consumer-app data. |
| OPIS | Public retail-fuel materials describe broad outlet coverage and real-time products. | Reviewed materials do not establish a public app-facing station-price API, rate card, or mobile-app license. Contact for feed/API availability, cost, freshness, coverage, and redistribution rights. |
| EIA | Free API can provide aggregate retail fuel-price benchmarks. | Weekly aggregate series, not station-specific nearby prices; cannot replace the current station-list feature. Potential context/benchmark only. |
| OpenStreetMap | Open map data can be a possible source for station locations and community fuel-type tags. | Not a reliable live station-price source. Review attribution and ODbL obligations, particularly for derived/redistributed data. |

### Research links and verification

- Google [Place resource](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places), [place types](https://developers.google.com/maps/documentation/places/web-service/place-types), [pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), and [API-key security guidance](https://developers.google.com/maps/api-security-best-practices).
- GasBuddy [company overview](https://www.gasbuddy.com/about).
- OPIS [retail fuel prices](https://www.opis.com/product/pricing/retail-fuel-prices/), [PricePro](https://www.opis.com/product/pricing/retail-fuel-prices/pricepro/), and [Retail Radius Report](https://www.opis.com/product/pricing/retail-fuel-prices/retail-radius-report/).
- EIA [retail price series](https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_nus_w.htm), [API overview](https://www.eia.gov/opendata/), and [API documentation](https://www.eia.gov/opendata/documentation.php).
- OpenStreetMap [fuel-station tagging](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dfuel) and [copyright/license](https://www.openstreetmap.org/copyright).
- Reviewed October 6, 2026. Rates and provider terms can change; re-verify them when making the source decision.

### Required decision work before station integration

1. Confirm launch geography and fuel types.
2. Test Google fuel-price coverage and timestamp age in representative locations; obtain confirmation for billing tier and expected single-user costs.
3. Confirm attribution, display, caching, privacy-policy/terms, and app distribution/use obligations.
4. If coverage, freshness, cost, or terms are unsuitable, contact GasBuddy and OPIS for documented API/feed access and quotes.
5. Select a credential strategy. Never treat a mobile-bundled API key as confidential; use provider-allowed app/API restrictions and quotas, or a narrowly scoped server-side proxy if required.
6. Record a written provider decision or blocker, then define response mapping, request bounds, pagination, timeout/retry behavior, and outage semantics.

If provider terms, coverage, cost, or credential model are unclear or unsuitable, keep the decision blocked rather than shipping an unlicensed or insecure integration.

## Ordered work and completion criteria

### 1. Finish the inventory

- Confirm feature scope and list every externally sourced, user-entered, imported, and derived field.
- Record current mock-data usage and identify UI elements with unfinished actions.
- Completion: this source map has an owner/source for each field and no planned feature is presented as implemented.

### 2. Decide sources and contracts

- Complete the gas-provider comparison and document the decision or blocker.
- Define vendor-independent station, price, transaction, goal, pocket, pause-rule, subscription, and activity contracts as their features enter implementation.
- Define import format support and the recurring-candidate evidence/confidence model before accepting production CSVs.
- Completion: field mappings, provenance, freshness, privacy, failure behavior, and acceptance cases are reviewed before adapter work begins.

### 3. Integrate without retiring fixtures

- Add typed repositories/adapters and keep deterministic fixture adapters available for development and tests.
- Implement the real station adapter only after a provider decision. Implement personal finance features with local persistence and user-selected CSV input.
- Verify loading, empty, denied, offline, stale, malformed, duplicate, and recovery flows, as applicable.
- Completion: contract and adapter tests pass; real data is visibly distinguished from fixture/sample data; on-device behavior is tested.

### 4. Review mock retirement separately

Retirement is allowed only after every feature has an approved source or data owner, complete field mapping, tested transformations, verified user-facing failure behavior, and evidence that its replacement works. Verify privacy, persistence, migration, and user-controlled export/deletion for personal data. Then remove only obsolete production fallback paths by a separate deliberate change; preserve fixtures needed by tests.

## Decision log

| Decision | Status |
| --- | --- |
| App privacy model | Private, single-user, local-first; no shared backend assumed |
| Initial gas coverage geography | United States only |
| Personal transaction source | User-selected CSV import, processed on-device by default |
| Bank linking / FinanceKit | Out of scope unless explicitly decided later |
| Gas station services | Google Places proxy and OSM/local service implementations exist; verify configuration, coverage, terms, freshness, cost, and production suitability before treating either as an approved source |
| Existing station fixtures | Retain through source mapping, integration, and verification |
| Navigation approach | Grouped Gas, Savings, Money, and Activity tabs are restored; preserve tab routes and access to secondary flows |
