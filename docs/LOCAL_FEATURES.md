# Local roadmap implementation — October 15, 2026

## Account and insights

Account has a collapsible Why this amount? breakdown using the same balance calculator as savings and widgets. Imported dates now have an explicit source calendar date; older records keep a stored-date compatibility fallback because their original import timezone cannot always be reconstructed. Original timestamps and transaction IDs stay intact.

Account review restores hidden rows and presents possible one-to-one local-purchase/bank links. Similar bank rows, including pending/posted variants, require an explicit duplicate decision. Equal real purchases stay distinct by default. Reviewed duplicates and their linked shadow purchases are excluded by the shared financial projection, including subscription evidence. Decisions retain raw rows and have Undo. Existing savings assignments are retained and must be reviewed separately if two imports applied a rule. Reprocessing preserves decisions while clearing an exclusion if its canonical amount changes.

Insights uses posted/logged activity, corrected directions, categories and classifications for the linked account. Hidden rows still count; pending rows and savings adjustments do not. Transfers, refunds and reversals are separated from ordinary spending/income. Coverage merges parsed statement periods and warns about gaps. Optional monthly category budgets never reserve money. The 30-day real-subscription forecast stays separate from the Account balance. CSV and text exports exclude sample subscription data; CSV quotes cells and escapes spreadsheet formulas while retaining signed decimal amounts.

## Imports and automation

Multi-file review accepts up to 12 PDFs/CSVs, bounded to 30 MB. Files are parsed sequentially; each still uses the established import review/match/balance/journal path. One selected PDF can offer a balance update; that selection locks after the first save. Closing/restarting discards unsaved in-memory drafts; saved originals and records remain recoverable.

Native folder selection reads a deliberately chosen Files folder and skips byte-identical archived content (including renamed files). Missing originals remain candidates. The folder is not watched and access is requested each time. `gasfinder://bank-batch` can be opened from a user-created URL → Open URLs shortcut. Citizens authentication/download remains in Citizens; no bank credentials are collected.

Signed-amount CSVs require explicit confirmation of which sign means spending whenever rows lack usable debit/credit type evidence. A positive-only CSV cannot silently choose a financial direction in the import UI.

Settings includes a configurable local statement reminder (off by default), based on the latest saved statement date. It does not know whether Citizens has issued a new PDF. Notification permission is requested only on enabling. Local purchase handoffs retain at most 30 timestamp/outcome entries without merchant, amount, file/link or raw payload. User-invoked shortcut links open reviewed app screens.

## Scanned statements and receipts

The optional native Vision/ML Kit module also renders up to 12 scanned bank pages locally, with bounded dimensions, text and file size. Scanned imports require row-by-row confirmation and fully matching summary reconciliation; partial, unavailable or mismatched totals cannot be overridden. OCR never uses quick automatic import. Web and older native builds show manual/text-PDF alternatives. Native accuracy and actual Citizens scan layouts still require real-file acceptance; recognition output alone is not verification. See FUEL_REPORTS.md for the combined price/refill flow.

## Trips, Amazon and checkout

Trips support saved destinations, preferred/avoided stations, stop swap/removal and full/partial refill targets. Editing a stop invalidates verification. Explicit road verification asks the existing public routing services for every chosen waypoint, checks routed fuel legs and displays the smallest estimated safety margin. Missing/failed route evidence stays unverified. Estimated detour economics uses recent stop prices, a user-entered comparison price and conservative MPG assumptions, excluding time cost. This is road-network evidence, not proof of open pumps or current road conditions.

Amazon shared product URLs enter the existing reviewed draft. Existing product goals have a user-requested price lookup with old/new target comparison and explicit confirmation; assigned savings never decrease when the target changes. A changed goal blocks a stale review from saving. Public lookup failure retains manual entry. Images and background price monitoring remain optional.

Chrome companion v1.1.0 is packaged as `public/downloads/GasFinder-Chrome.zip` by `npm run build:chrome-extension`; setup provides desktop instructions, download/copy handoff and same-folder update steps. The extension has a visible one-shop ten-minute override, an expiry alarm and startup restoration. No alarm support means no temporary override. Browser suspension/disabled extensions can delay enforcement. App Settings reports installed/enabled separately and explicitly cannot read the browser-local active pause. Rules have repeatable URL fixtures; physical Safari/Chrome coverage testing is still required.

## Reset, erasure and builds

A backup-first account reset/switch clears the active financial ledger/goals/set-asides and shortcut account setup, unlinks retained fuel reports and moves originals to Trash. It keeps cars/subscriptions and has durable local Undo through Backup & restore. This is one active account, not simultaneous account balances.

Settings now opens nine category rows with controls on separate subsection screens. Permanent erasure is available in Settings → Data & backups and Backup & restore; it requires acknowledgement, typing ERASE ALL DATA and a separate final confirmation. It clears managed records, app-owned originals/photos and recovery journals; it retains external exported files and device privacy settings. An erasure marker resumes interrupted removal at startup and blocks writes if cleanup fails. Do not confuse history hiding, recoverable reset and permanent erasure.

Private development/preview/stable/simulator build profiles and capability notes are included. No EAS account, cloud deployment, paid membership, OTA service or bank feed is configured automatically. See PRIVATE_BUILDS.md.

## Verification and remaining gates

- 259 logic tests, lint, TypeScript and iOS/Android/web JavaScript exports pass.
- Synthetic browser batch import saved an outgoing $3.50 and an incoming $5.25 with no deposit purchase created. Encrypted CSV-original export/inspection and reset → reload → Undo restored the two financial records.
- Encrypted original/photo restoration across isolated browser origins and Undo passed. Similar equal bank purchases remained distinct by default; reviewed exclusion and Undo passed. No permanent erasure of user data was performed during testing.
- Native iPhone file/Shortcut permissions, notification delivery, privacy behavior, real OCR accuracy, extension coverage and signing-dependent widgets remain phone acceptance tasks.
- Android ML Kit compilation/device accuracy remains an Android acceptance task.
- Multi-account balances, cloud/shared-price services, broader bank/credit-card models, product images, indefinite Live Activities and OTA infrastructure remain optional or depend on format samples/service decisions.

Native verification: a clean ad-hoc iOS simulator build passed with the local OCR module and correctly packaged Safari extension. This does not verify phone recognition quality, device signing, notifications or standalone cold launch.
