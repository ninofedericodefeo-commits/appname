# Local bank PDF and CSV import

In Goals → Activity, tap the upload icon (**Import bank PDF or CSV**), or use **Import bank PDF or CSV** in Subs. Choose a Citizens checking/savings statement PDF, a transaction CSV exported by any bank, or paste CSV contents. The source file is read locally, its cache copy is removed when possible, and the original PDF/CSV is never saved in app storage or uploaded to a service.

## Citizens checking/savings PDFs

Download the original statement from Citizens online banking or its app, then choose it from Files. The initial importer supports text PDFs with an identifiable full statement period and dated **Deposits & Credits**, **Withdrawals & Debits**, **Other withdrawals**, or equivalent supported deposit/withdrawal sections. It handles transaction amounts before/after descriptions, wrapped descriptions and continuation pages. Short transaction dates get their year from the statement period, including year boundaries.

- Up to 10 MB, 40 pages, 5,000 transactions and 2 million extracted characters. Reading can be canceled; a 45-second timeout offers a smaller-file retry.
- PDF.js and its processing engine are bundled with the app. A local Expo DOM component extracts positioned text in a WebView on native and directly in the browser on web. No bank statement is uploaded, and no CDN worker, OCR service or bank login is used.
- Review each date, description and amount against the original PDF. Rows identify PDF page and extracted line (not a printed transaction number). Unreadable or ambiguous transaction rows are reported; they are never guessed.
- Identified credits/refunds, transfers, card-balance payments, ATM cash withdrawals and fees are excluded from purchases. Checks, fee-only sections, account summaries and running balances are not imported. Other transfer descriptions may still need manual deselection. This is a purchase-history import, not full account reconciliation.
- Unsupported banks (including First Citizens), Citizens credit cards, explicit non-USD currency, multiple identifiable accounts in one PDF, password-protected PDFs, scans/photos and unsupported table layouts show an error. Download separate statements for each account. CSV remains available for unsupported PDFs; there is no OCR yet.
- The original PDF and positioned text are discarded after extraction, cancellation or leaving the screen. App storage retains only confirmed purchase records, local source metadata/account nickname and deduplication keys. Statement balances are never treated as entered balances.

The initial PDF layouts are covered by **synthetic** fixtures. A redacted real Citizens checking/savings statement has not been provided; verify that exact layout on a physical phone before relying on its purchase history.

## Review

- Give the account a nickname and keep it consistent on later imports. The last successful nickname is remembered. It scopes import identities across accounts.
- Common date/description/amount or debit/credit headings are detected. Tap column fields to correct them. More columns exposes currency, transaction type, status and transaction ID.
- Check whether money spent is positive or negative. Choose month/day or day/month for slash dates; ISO calendar dates are also supported. Dates need a four-digit year. Invalid/future dates and invalid amounts are shown among skipped rows.
- CSV supports quoted commas, escaped quotes, embedded newlines, UTF-8 BOM, CRLF, tab and semicolon separators. Limits: 2 MB and 5,000 transaction rows. Other-bank PDF/XLSX statements still need a CSV export.
- Known credits/refunds/transfers/payments, pending entries, zero amounts and non-USD rows are excluded. Different banks label transfers differently: review selections and deselect internal transfers or card-balance payments before importing. The app cannot infer all transaction categories.
- New spending rows start selected. Same-date/same-amount matches to existing Apple Pay, manual or bank entries start unchecked and identify the matching entry. Include a possible match only if it is a different purchase. Already imported identities cannot be selected again.

## Pocket accounting

The default is history only. **Apply my goal’s rule** is optional, with the exact capped pocket change shown before confirmation. A confirmed import applies the current rule oldest first, capped by the active goal remainder and manually entered available balance. It never infers or changes an account balance, converts currencies, moves money or releases earlier savings because of a refund.

Actual purchase dates are preserved, so imports contribute to the existing 30-day spending history. Imported entries say **Citizens PDF** or **Bank CSV** in Activity. Editing or deleting one follows normal purchase behavior: an earlier set-aside remains until lowered explicitly in Edit goal.

Import IDs use the account nickname and the bank transaction ID when available. Without IDs they use date, amount, normalized description and the occurrence number of an identical row. Repeat/overlapping exports are deduplicated. Keys remain after deleting a purchase to avoid reserving again on reimport. Changed bank descriptions or incomplete exports of repeated identical transactions can be ambiguous; possible-match review is deliberately conservative.

## Subscription suggestions

Confirmed bank imports feed **Subs → From bank history** automatically, including existing bank CSV purchases. Monthly (25–37 day intervals) and yearly (350–380 day intervals) repeated charges with similar prices produce suggestions. The latest six charges provide visible date/amount evidence; recent monthly charges must be within 65 days and annual charges within 400 days. Very different prices and frequent/irregular charges do not qualify. A single known subscription provider or explicitly recurring charge is labeled **Possible subscription**; one charge cannot establish a billing cadence.

**Review & add** prefills an editable name, latest charge, cadence and renewal day/month. Posting dates and prices are estimates; confirm them with the provider. Only **Add subscription** creates a subscription. Dismissals persist and can be restored. Existing subscriptions, including renamed imported ones and entries marked canceled, are not suggested again. Suggestions do not alter savings or enable reminders. Generic Amazon purchases and ambiguous Apple bill descriptions are not treated as known subscriptions.

## Development build

`expo-document-picker` is an SDK-compatible native dependency. Rebuild the phone app once with `npx expo run:ios --device` (or the Android equivalent) to enable file selection. Loading it is deferred so older development builds can open the screen and use **Or paste CSV**. PDF support adds a JavaScript dependency only and reuses the existing WebView. No iCloud storage, App Group, push or bank API capability is added.

## Verification

- PDF tests run the bundled extraction engine against a synthetic three-page statement with two amount-column layouts, verify no network fetch, filtering, wrapped/continued descriptions, date inference, unsupported/ambiguous PDFs, source metadata and CSV/PDF reimport identity. Subscription tests cover monthly/yearly/calendar patterns, evidence, estimated price, single-charge confidence, stale/noisy patterns, transfers/fees and existing/dismissed entries.
- Tests cover quoted CSV, malformed input and size/row limits, date/money validation, direction/currency/status filtering, stable and account-scoped IDs, repeated purchases, overlap/cross-source matches, deletion/reimport, history-only accounting and rule/goal/balance caps.
- Browser checks with synthetic data verified file selection, paste, column selection, an unchecked cross-source match, exact rule accounting and disabled repeat imports at phone width.
- Browser checks also verified PDF file selection, nine history-only purchases, subscription prefill/edit/save, dismissal and restart persistence, duplicate PDF prevention, and the existing CSV paste/mapping flow at 390 px.
- Device gate: select/cancel a Citizens PDF and CSV in Files on iPhone and Android; check file/cache permissions and the old-build paste fallback. Review a real bank's headings and credit/debit convention without committing the statement or its contents to the repository.
