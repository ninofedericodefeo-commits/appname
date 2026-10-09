# Local bank CSV import

In Goals → Activity, tap the upload icon (**Import bank CSV**). Choose a transaction CSV exported by your bank or paste its contents. The source file is read locally, its cache copy is removed when possible, and the raw CSV is never saved in app storage or uploaded to a service.

## Review

- Give the account a nickname and keep it consistent on later imports. The last successful nickname is remembered. It scopes import identities across accounts.
- Common date/description/amount or debit/credit headings are detected. Tap column fields to correct them. More columns exposes currency, transaction type, status and transaction ID.
- Check whether money spent is positive or negative. Choose month/day or day/month for slash dates; ISO calendar dates are also supported. Dates need a four-digit year. Invalid/future dates and invalid amounts are shown among skipped rows.
- CSV supports quoted commas, escaped quotes, embedded newlines, UTF-8 BOM, CRLF, tab and semicolon separators. Limits: 2 MB and 5,000 transaction rows. PDF/XLSX statements need a CSV export.
- Known credits/refunds/transfers/payments, pending entries, zero amounts and non-USD rows are excluded. Different banks label transfers differently: review selections and deselect internal transfers or card-balance payments before importing. The app cannot infer all transaction categories.
- New spending rows start selected. Same-date/same-amount matches to existing Apple Pay, manual or bank entries start unchecked and identify the matching entry. Include a possible match only if it is a different purchase. Already imported identities cannot be selected again.

## Pocket accounting

The default is history only. **Apply my goal’s rule** is optional, with the exact capped pocket change shown before confirmation. A confirmed import applies the current rule oldest first, capped by the active goal remainder and manually entered available balance. It never infers or changes an account balance, converts currencies, moves money or releases earlier savings because of a refund.

Actual purchase dates are preserved, so imports contribute to the existing 30-day spending history. Imported entries say **Bank CSV** in Activity. Editing or deleting one follows normal purchase behavior: an earlier set-aside remains until lowered explicitly in Edit goal.

Import IDs use the account nickname and the bank transaction ID when available. Without IDs they use date, amount, normalized description and the occurrence number of an identical row. Repeat/overlapping exports are deduplicated. Keys remain after deleting a purchase to avoid reserving again on reimport. Changed bank descriptions or incomplete exports of repeated identical transactions can be ambiguous; possible-match review is deliberately conservative.

## Development build

`expo-document-picker` is an SDK-compatible native dependency. Rebuild the phone app once with `npx expo run:ios --device` (or the Android equivalent) to enable file selection. Loading it is deferred so older development builds can open the screen and use **Or paste CSV**. No iCloud storage, App Group, push or bank API capability is added.

## Verification

- Tests cover quoted CSV, malformed input and size/row limits, date/money validation, direction/currency/status filtering, stable and account-scoped IDs, repeated purchases, overlap/cross-source matches, deletion/reimport, history-only accounting and rule/goal/balance caps.
- Browser checks with synthetic data verified file selection, paste, column selection, an unchecked cross-source match, exact rule accounting and disabled repeat imports at phone width.
- Device gate: select/cancel a CSV in Files on iPhone and Android; check file/cache permissions and the old-build paste fallback. Review a real bank's headings and credit/debit convention without committing the statement or its contents to the repository.
