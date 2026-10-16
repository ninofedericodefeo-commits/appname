# Account correctness fixes — October 15, 2026

This batch implements final-roadmap **R01–R05**. Draft protection, batch balance setup, recovery completion and the broader accessibility work remain in the [roadmap](../ROADMAP.md).

## What changed

- **Keep both / Different purchases:** a separate-purchase decision is persisted with the pair and an evidence fingerprint. It hides only that reviewed suggestion; both real movements continue to count. Undo is available in the Kept separate history. Amount, direction, account, date, posting-status or merchant evidence changes can reopen review. Renaming an identified account or filling in the same source calendar day does not reopen an unchanged pair.
- **Effective directions:** review eligibility, display, badge counts and save-time validation use direction corrections. Corrected deposits are not outgoing purchase matches. Corrected withdrawals can match. Bank duplicate decisions use effective signed amounts; a later correction/reimport that makes an exclusion incompatible removes that exclusion rather than silently hiding a different movement. Original raw evidence stays intact. An old duplicate is not silently reapplied when a correction is undone; it can be reviewed again.
- **Negative bank balances:** Update bank balance accepts signed cents, with an Overdrawn / negative checkbox so the decimal keyboard does not need a minus key. Zero and positive balances still work. Purchase/goal/savings parsers stay nonnegative; negative available funds cannot fund a new set-aside. The confirmed manual snapshot retains its date and known-movement baseline.
- **Calendar validation:** one shared calendar-key parser rejects rolled-over dates such as February 30. History filters, Insights, subscriptions and the shared date control use it. Source calendar dates and original timestamps remain separate.
- **Reachable review history:** candidates have 25-item pages, search and Previous/Next. Hidden records and link/duplicate/separate-decision histories are also paged, without the former 30/50/100 display ceilings. Account badges use 100+ when a bounded count is exceeded. Full history and Settings → Account & statements have an always-available review link. Existing decisions now identify the related merchants, amounts and dates. Undo is available only for the current applicable decision on a bank row, so an older action cannot undo a later replacement.

## Persistence and recovery

Pocket storage moves from **version 13 to 14**, adding an empty `separatePurchaseDecisions` collection to older records. Existing IDs, balances, purchases, savings assignments and earlier corrections are retained. Separate decisions are included in managed encrypted backups/reset/erasure. Parser ID repairs remap decision and Undo references; fingerprints omit record IDs so unchanged evidence remains recognizable.

Review mutations use the existing recoverable bank-operation journal and backup validation. A deliberately excluded duplicate with corrected raw signs is validated against the effective amounts, not rewritten raw data.

## Verification

- **273/273 logic tests pass**, including 14 new regression tests covering sign corrections, persistent/undone separate decisions, reimports, parser ID repairs, 250-pair paging/search, negative/zero/bounded balance snapshots, invalid/leap dates and an encrypted synthetic backup round-trip.
- Lint, TypeScript, `git diff --check` and iOS/Android/web JavaScript exports pass.
- Existing synthetic browser ledger survived version-14 hydration. Keep both → reload retained the decision; Undo restored the candidate; keeping it again retained two actual purchases. Settings' direct review entry was checked.
- An isolated browser origin saved −$12.34 using the checkbox and retained it after reload, without changing the main preview's bank snapshot.
- No real bank files were read/uploaded, no actual user data was erased, and no set-aside contributions were altered by the separate-purchase checks.

Browser proof artifacts are in `/tmp/gasfinder-correctness-proof/`; temporary artifacts are not committed. Real-phone keyboard/screen-reader acceptance and native release installation remain R31–R34 gates. No native module/dependency/capability was changed in this batch; JavaScript exports do not establish phone acceptance.
