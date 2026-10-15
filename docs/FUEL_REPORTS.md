# Fuel reports and receipts

The shared Price or refill form records a deliberately selected station (or explicit address/location), fuel, standard/cash/card/member price and observation time. Photos and refill details are optional. Price reports and older receipts retain their IDs and remain editable in Fuel reports & receipts. Trash is recoverable and does not remove Account charges.

Totals use integer cents and thousandths for unit price/gallons. Differences over ten cents require confirmation, with fees/discounts retained. Account linking is explicit: report only, link a reviewed existing charge, or create a purchase. Similar charges require review; importing a matching bank charge later uses the existing purchase reconciliation path. Goal rules are off by default for refill logging.

Recorded cost and per-car views exclude Trash and collapse reports linked to the same Account charge. Equal separate charges remain separate. MPG requires two compatible full fills, odometers and confirmation that intervening fills were recorded; partial fills contribute volume only inside a complete interval. These are recorded receipt statistics, not complete bank coverage.

Receipt photos persist in app files on native and IndexedDB on web and can be included in encrypted backups. Photo edits write a new physical file. Backup restores remount forms to prevent stale drafts writing over replaced records.

The local receipt-ocr module uses Apple Vision and bundled Android ML Kit. Suggestions require review and never save financial data themselves. Unavailable recognition leaves manual entry usable. The OCR module compiles in a clean iOS simulator app build. Android compilation, real receipt quality and native device-to-device photo restore still need acceptance. Synthetic browser photo backup/restore/Undo across separate origins passed. Scanned bank statements are a separate feature and do not use this recognizer.

Verification: 244 logic tests, lint and TypeScript pass. Synthetic browser entry, photo persistence and report-only behavior were checked. No real receipt or payment details were used in browser fixtures.
