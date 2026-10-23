# Savemage — draft privacy disclosures

Updated October 22, 2026. Private development app; these are preparation notes, **not submitted App Store Connect answers or a declaration of legal compliance**. Publisher, privacy contact, public hosting and provider retention remain unconfirmed. The owner requested a draft only.

## Policy locations

- In app: Settings → Privacy → Privacy policy (draft). Also available in About.
- Plain-language disclosures: Settings → Privacy → How your data is used.
- Shared policy source: `src/features/privacy/policy.json`.
- Static draft for future hosting: `public/privacy.html`. Rebuild with `node scripts/build-privacy-policy.mjs` after editing the source. No network assets, analytics or contact form are embedded. It is labeled Draft and noindex; it has not been deployed by this change.

Apple requires a public privacy-policy URL in App Store Connect and an easily accessible policy inside the app. A local route or repository file alone does not complete the public-URL requirement. See [App Review Guidelines §5.1.1](https://developer.apple.com/app-store/review/guidelines/#privacy) and [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).

## Data inventory and draft answers

Apple defines collection in terms of data transmitted off-device and available longer than needed to service a real-time request. On-device processing alone is not collection. Include applicable partner practices. **Do not select “Data Not Collected” solely because the ledger is local.** The online providers and deployment must be assessed first. See [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

| Feature / information | Current handling | App Store disclosure treatment |
| --- | --- | --- |
| Account name, balances, statements, transactions, budgets, bills, goals, purchase history | AsyncStorage/local files; no bank login or automatic ledger upload | Financial Info / Purchases / User Content are not collected by these local paths. Reassess if a future upload or sync is added. |
| Receipt photos, imported PDFs/CSVs and extracted text | User-selected files; local OCR/parsing; app-private file copies | Photos or Videos / Other User Content not collected by the local import paths. Export destinations and OS backups are separate. |
| Location and route endpoints | Location permission optional; geographic search region and route coordinates go to station/routing services | Evaluate Precise Location vs Coarse Location based on coordinates actually transmitted and retained. Station bounding boxes and route endpoints can reveal precise areas. App Functionality is the relevant purpose when retained to provide the service. Do not mark “not linked” without verifying provider linkage. |
| Typed city, ZIP, address or destination | Photon/address search or routing provider receives query | Evaluate Search History and/or Location, depending on retained content and use. An address can identify a person. |
| Viewed map area and network metadata | OpenStreetMap tile requests include tile coordinates, client IP and request headers | Confirm provider log retention and use; assess Location and any applicable identifiers/diagnostics. Do not mechanically classify every IP address as Device ID: use Apple's definitions and the actual processing. |
| Amazon listing URL / identifier | iOS/Android: direct Amazon WebView using an incognito session with shared cookies off; web: same-origin lookup API fetches Amazon | Assess Product Interaction / Search History / Browsing History as applicable to retained listing requests and actual provider use; this request is not proof a purchase occurred. Confirm Amazon and web-host logs before final answers. |
| Wallet automation drafts | Optional local merchant, amount, currency, timestamp; hashed transaction ID for deduplication; max 200 drafts, 30-day expiration; queue excluded from device backups | Not collected through the local queue; no card number or bank credentials received. Saved entries become local ledger records. |
| Checkout pause extension | Local browser settings and declarative request blocking; no page-content reader or history uploader | No developer collection established in companion code. Explain its selected-domain blocking and separate local storage in policy. |
| Supported app matching | iOS checks supported URL schemes, not all installed apps; Android can inspect launchable apps locally | No upload found. Do not claim universal app discovery or include Android-only inventory as an iOS network collection. |
| Notifications / widgets / authentication | Local reminders and widget data; OS biometric result only | Not developer collection in current paths; content may appear outside app. No biometric template accessed. |
| User-initiated exports / support | Share sheet sends file to chosen destination; no support upload endpoint | Explain user-directed sharing. If a public support channel is added, assess retained contact details and attachments separately. |
| Advertising / analytics | No advertising SDK, cross-app tracking code or app analytics uploader found | No tracking established in current app code. Final answer still requires third-party and release-build review. No blanket partner no-tracking assertion. |

## Runtime destinations to confirm before release

The current default code uses:

- Stations: `overpass-api.de`, `overpass.openstreetmap.fr`, `overpass.private.coffee`.
- Address search: `photon.komoot.io`.
- Driving routes: `router.project-osrm.org`, `routing.openstreetmap.de`.
- Tiles: `tile.openstreetmap.org`, unless overridden by `EXPO_PUBLIC_MAP_TILE_URL`.
- Optional configured station service: `EXPO_PUBLIC_STATIONS_API_URL`; inspect the actual production service and its upstream providers.
- Amazon: the listing host; web lookup also uses `/api/amazon-product` on the deployed app host. The route has `Cache-Control: no-store` and no explicit persisted request history, but hosting logs are a separate question.
- External directions, merchant and provider links: the destination service the user opens.

The legacy demo gas-price API is not phone-to-phone sync in the current reporting UI. Do not describe a public crowdsourcing service as active without wiring and auditing that flow. Review any configured demo endpoint separately before shipping.

## Retention and user control

- Local saved financial records persist until changed or erased. Statement Trash is recoverable until permanently deleted.
- Pending native Wallet inbox: at most 200 entries, expires after 30 days. Its recent capture-outcome log is capped at 30 entries and excludes merchant/amount/raw payload.
- Settings → Data & backups → Erase all app data removes managed records, imports, receipt files, drafts and inbox. Device-protection preferences remain. Exported copies, device backups and browser extension storage require separate management.
- App lock does **not** encrypt the ledger. Exported encrypted backups use their own password. Do not advertise all local storage as app-encrypted.
- Regular app documents/preferences may enter OS backups. The native purchase inbox is explicitly excluded. Do not claim the whole app is excluded from iCloud/device backups.
- Provider/server retention is **unknown** until the actual operators and hosting configuration are confirmed; this prevents a final zero-collection declaration.

## Before public distribution

1. Supply actual publisher identity and a working privacy contact; review the draft text.
2. Confirm final name availability and any applicable trademark rights; preliminary search is not clearance.
3. Confirm release endpoints and provider/host logging, retention, linkage and tracking practices. Update the inventory and policy accordingly.
4. Set final Apple privacy answers by data type, purpose, linkage and tracking. Do not guess “not linked” or “not collected.”
5. Host the completed policy at an accessible HTTPS URL without login, then enter that URL in App Store Connect. Remove draft/noindex text only when appropriate.
6. Review native SDK privacy manifests and required-reason APIs in the final archive. This document and a policy URL do not replace manifest declarations or submission validation.

## Evidence

Reviewed `src/lib/appStorage.ts`, `src/features/privacy/PrivacySettingsPanel.tsx`, `src/features/data/{fileIO,backupService,backupFormat}.ts`, `src/features/bank/{scannedStatement,archiveStorage}.ts`, `src/features/receipts/photoStorage.ts`, `modules/receipt-ocr/ios/ReceiptOcrModule.swift`, `modules/purchase-inbox`, `src/features/goals/AmazonProductLookup{,.web}.tsx`, `src/app/api/amazon-product+api.ts`, station/map/location modules and `extensions/spending-pause`.

This is a source review of the current private version, not a packet capture, third-party privacy audit, legal opinion or App Store approval guarantee.

## Implementation checks

- Lint and TypeScript checks passed; all 390 logic tests passed. Tests requiring temporary local servers ran with local networking enabled after the sandbox blocked server binding.
- Browser preview: policy and disclosure pages inspected in light/dark at 320 and 1024 pixels, with wrapping and readable maximum width; no horizontal document overflow. Settings links and the standalone HTML policy opened successfully. Temporary theme/viewport changes were restored.
- Independent source review corrected the Amazon cookie wording: incognito/shared-cookie restrictions do not disable all first-party session cookies.
- Native iPhone/iPad rendering and installed extension/widget names were not tested in this batch. The new installed app name and native companion copy require a rebuild. Legacy identifiers, saved data, backup formats, shortcut filenames and download paths were preserved.
