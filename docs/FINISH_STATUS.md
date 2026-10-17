# Finish status

Updated October 16, 2026. Scope: private personal installation, four main tabs, no App Store publication.

## What is implemented

R01–R05 were delivered in `34479de`. The remaining local finish work now implements R06–R30:

- Changed subscription/savings/goal/car/import/report forms have explicit dismissal boundaries. Long source/report drafts are device-local, resumable and discardable; originals are never put in URLs. Reports stage photos in app storage. Drafts are excluded from portable backups and cleared during reset/restore/wipe. Import source recovery deliberately resets review choices and balance consent.
- Batches require Keep balance or one readable dated PDF before the first reviewed save. Choice locks after the first save. Files, chosen balance and per-file save status survive restart; each file still receives normal review. Read failures and draft storage errors remain visible.
- Restore/reset/wipe have a completion notice. Erasure keeps its restart marker until all cleanup and completion recording succeed. Tests inject interruptions at five cleanup stages; no real installation was erased.
- Contextual Settings destinations, optional quick-action wording, and Hide/Delete/Trash semantics are clearer. Monthly renewal uses a day selector; yearly recurrence uses month/day, without a fabricated March date. Reports and trip planning disclose optional details. Monthly budgets only compare a full calendar month/current month to date.
- A fuel report opens its linked charge, including hidden history. Insights links open exact merchant/category evidence with matching date, classification and pending/hidden rules. Price charts include paged dated rows.
- Semantic light/dark palettes and stronger contrast, reactive deferred styles, OS-aware status bar and reduced motion, larger calendar/link targets, headings, toggle state, validation announcements, modal confirmation focus, wrapping rows and complete amounts. Narrow calendars use chronological day tiles instead of squeezing seven columns. Accessibility acceptance on the personal phone remains open.
- General & appearance adds System/Light/Dark and start screen; deep links take precedence. Gas Map/List and subscription List/Calendar persist. Gas filters have a reset action. Subscription reminder hour and lead reschedule the owned notification set; defaults remain 9 AM/day before.
- Device-only amount privacy covers financial screens and their open modals without unmounting drafts; it also removes underlying accessibility content while covered. Notifications/renewal previews hide amounts. Widgets, encryption and app lock remain distinct controls.
- History has date presets. Backup preflight shows local file availability/estimated size, all/available/records-only scopes, missing-photo markers and last creation date without claiming external saving. Legacy demo navigation is hidden when empty.
- One manual movement form supports purchase date, optional goal rule, and deposits/refunds with positive signed credits and classification. No savings contribution is created for credits. Future statement duplicates still require review. A skipped purchase rule does not leave another automatic savings prompt.
- Settings search and a skippable setup/help checklist are available. Category bars have textual totals and supporting-row links.

Optional row-density controls and backup reminders were not added: the roadmap explicitly allowed omitting additions that increase complexity. They are not open core tickets. Cloud sync, automatic bank downloads, public price services, extra financial products and App Store distribution remain out of scope.

## Accessibility follow-up

Settings → Accessibility adds bolder text, larger controls, motion and station-list preferences. Native screen readers select List first while preserving an explicit Map choice. Forms associate and focus errors; transactions speak status/source/direction and show Money in/out; station controls are contextual; web dates and tabs support keyboard navigation. See [details and phone acceptance](ACCESSIBILITY.md). Settings schema 5 migrates additively.

This follow-up passes 295 tests, lint/TypeScript and all-platform JavaScript exports (`/tmp/gasfinder-accessibility-export`). Browser proof is `/tmp/gasfinder-accessibility-proof/settings.png`; checks use synthetic data at 320/390 px. Physical assistive-tool acceptance stays open. The native build evidence below belongs to the earlier finish batch.

## Evidence

- 290 logic tests pass, including 17 new finish regressions. Lint, TypeScript and diff checks pass.
- All-platform JavaScript export: `/tmp/gasfinder-finish-export` (rerun after finishing edits).
- iOS simulator Debug and Release builds pass. Logs: `/tmp/gasfinder-finish-native.log`, `/tmp/gasfinder-finish-release.log`. This is compilation/bundling evidence, not a physical-phone result. No signing identity, paid service or app identifier changed.
- Screenshot proof: `/tmp/gasfinder-finish-proof/settings-dark.png` (phone-width appearance controls).
- Browser checks at 320 px: appearance/start-screen persistence; monthly day selection; changed draft Keep editing/Discard; confirmation heading focus and return to Add; fuel draft recovery with original fields; 48 × 48 calendar day targets.
- Isolated browser origin: a $10 manual refund changes a previously checked −$12.34 estimate to −$2.34 while preserving the snapshot. Amount privacy hides the financial accessibility tree and reveals without resetting records. The generated encrypted backup reopened and validated its current store schemas and available-file scope. The preview was inspected without replacing data.
- Synthetic backup: `GasFinder-2026-10-16T23-45-29-321Z.gasbackup` in local Downloads. This is verification data, not the user's real bank backup. No personal statements/receipts or passwords are committed.
- Repeatable benchmark: `node --experimental-strip-types scripts/benchmark-local.mjs`. Desktop Node baseline for 10,000 movements: merge/reimport 28 ms, projection/sort 12.7 ms, annotate 11.7 ms, monthly filter 0.9 ms, summary 7.1 ms, duplicate pages 13.6 ms. Maximum supported 5,000-row CSV parse/preview 18 ms. Heap increase ~13 MB; not a peak-memory measurement. Results vary by hardware. CSV input remains bounded to 5,000 per file.

## What remains before calling the installed app finished

These are acceptance gates and any fixes they uncover, not a new feature expansion:

1. **R31 — Personal installation and recovery:** real iPhone standalone Release cold launch with the computer off; airplane-mode local records/cache; same-identity update preserving data; separate-install encrypted restore, attachments and Undo.
2. **R32 — Real Citizens/Wallet flow:** actual supported statement page-2 spending, page-3 credits, empty statements, repeated/overlapping imports and balance consent through warm/cold Share/Shortcut. Verify eligible Wallet captures and interruption/storage-failure behavior. Parser/regression evidence exists; physical handoff has not been newly proven.
3. **R33 — Native integrations:** auth/relock/preview, notifications after permission changes and time-zone changes, reviewed real-photo OCR, Amazon fallback, Safari/Chrome checkout coverage/override. Verify widgets only if the chosen signing capabilities permit them; otherwise leave them accurately disabled.
4. **R15–R20 acceptance:** VoiceOver journeys, OS accessibility text sizes and 200% web text/keyboard sweep, modal/focus behavior and all remaining screen layouts on the intended device. Local controls and narrow layouts are improved; this is not accessibility certification.
5. **R34 — Device load:** typing/scrolling with 10,000 movements and larger original/photo/report libraries, PDF/OCR peak memory and offline/retry behavior. Android native acceptance is needed only if Android will actually be used.

No known unfinished core feature module is being held for a future batch. Treat the app as feature-complete for local implementation, with installed-device acceptance still open. Fix observed defects from those checks before labeling a personal build stable.
