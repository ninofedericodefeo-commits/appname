# Final app audit

**Date:** October 15, 2026 · **Code reviewed:** `b7c27a3` · **Product:** GasFinder, private personal use.

The implementation queue is in the [final roadmap](../ROADMAP.md). Proposed journeys are in [flowcharts](APP_FLOWS.md). This audit supersedes the findings-as-backlog in [the October 13 review](APP_REVIEW.md); it does not erase that history.

## Conclusion

The app has most of the intended functionality. The remaining work should make its behavior dependable, understandable and accessible before adding more integrations. Settings categories and the multi-confirmation wipe already exist and should remain.

The highest-value remaining fixes are durable transaction review decisions, matching that respects corrected directions, signed manual balances, real calendar-date validation, reachable review/history records, draft protection, and clearer recovery completion. The largest unclosed acceptance gate is a private iPhone installation used independently of the development computer.

No new balance corruption or data loss was reproduced in this audit. That does not establish that all native or financial edge cases pass.

## Evidence and limits

Evidence labels used below:

- **Observed:** reproduced through the current browser UI with existing synthetic records.
- **Source:** directly established by current code; device behavior is not implied.
- **Risk:** plausible failure needing a focused test before treating it as a confirmed bug.
- **Proposal:** a product improvement, rather than broken behavior.
- **Device gate:** cannot be closed by browser checks or JavaScript tests.

Reviewed all four main tabs, Settings/category routing, goal and subscription editors, transaction review/history, statement/batch/archive code, report/refill/trip flows, backup/reset/erasure, privacy, reminders, widgets, Amazon and checkout setup. Browser walkthroughs covered Account, Goals, Subscriptions, Settings-related navigation, report creation and transaction review. Detailed import/restore/native journeys were inspected in code and previous verification notes, rather than rerun with personal files. Narrow browser checks used 390 and 320 px widths. Browser trees were inspected; a real VoiceOver/TalkBack session and OS Dynamic Type test were not performed.

The 259 existing logic tests passed during this audit. Two additional read-only synthetic probes reproduced rejection of a negative amount by `parseDollars` and acceptance of `2026-02-30` by the history date filter. A raw withdrawal remains a match candidate because the matching function has no direction-correction input. None of these probes mutated app records.

No statements, receipts or financial records were uploaded; no cancellation, purchase, permanent erasure or restored-data replacement was performed. Existing synthetic review screens were opened and closed without changing financial decisions.

Priority: **P0** blocks trusting the installed app or recovery; **P1** affects correctness or completing a core task; **P2** is worthwhile clarity/convenience. Effort appears in the roadmap.

## 1. Correctness and recovery

### A01 · “Keep both purchases” does not resolve the review · P1 · Observed + Source

**What happens:** Account → Review → Similar bank rows → Review as one bank movement → Keep both purchases closes the confirmation. The pair remains, and Account still shows the same review count. There is no stored “these are separate purchases” decision. App-to-bank candidates likewise have no persistent “different purchases” option.

**Why it matters:** legitimate recurring equal purchases keep generating work; a large unresolved queue can obscure new matches.

**Fix:** persist pair-specific separate-purchase decisions, with Undo and explicit invalidation when relevant amount/date/account evidence changes. Default must continue to preserve both real charges.

**Evidence:** [Account review](../src/app/account-review.tsx), [candidate generation](../src/features/pocket/reconciliation.ts), [Account badge](../src/app/(tabs)/pocket.tsx). Roadmap **R01**.

### A02 · Match review uses raw directions instead of effective directions · P1 · Source

Both candidate generators receive raw bank rows; Account review does not pass `transactionDirections`. Its display/projection also calls `pocketTransactions` without the correction map. A raw negative row corrected to a deposit can still be suggested as the match for an outgoing local purchase. This is an inconsistency with Account/Insights, which do apply corrections. The synthetic probe confirmed raw candidate eligibility; a resulting incorrect merge was not executed.

**Fix:** use effective signed amounts consistently for eligibility, preview, validation and save; preserve original evidence separately. Test corrected deposits/withdrawals, pending-to-posted changes and duplicate corrections. Roadmap **R02**.

**Evidence:** [Account review](../src/app/account-review.tsx), [reconciliation](../src/features/pocket/reconciliation.ts), [balance calculation](../src/features/pocket/balanceEstimate.ts).

### A03 · An overdrawn bank balance cannot be entered manually · P1 · Source + synthetic probe

Update balance uses the positive-only `parseDollars`; `setReportedBalance` also rejects negative cents. A checking account below zero cannot be mirrored through this flow. This is different from a positive balance becoming negative after set-asides, which the app already displays.

**Fix:** a separate signed bank-balance parser and store validation. Keep purchase amounts, targets and set-aside inputs nonnegative. Provide a usable minus entry on phone keyboards. Roadmap **R03**.

**Evidence:** [Update balance](../src/app/(tabs)/pocket.tsx), [money parser](../src/features/pocket/logic.ts), [balance setter](../src/stores/pocketStore.ts).

### A04 · Impossible history dates pass validation · P1 · Source + synthetic probe

`filterHistory` checks the text shape and whether `Date.parse` returns a finite value. JavaScript normalizes some impossible dates, so `2026-02-30` passes and then participates in string comparisons.

**Fix:** validate actual calendar components using one shared date-key parser, then offer date pickers and presets. Cover leap years, month ends and reversed ranges. Roadmap **R04**.

**Evidence:** [history filters](../src/features/pocket/repository.ts), [date field](../src/components/CalendarDateField.tsx).

### A05 · Review lists and Undo history silently stop early · P1 · Source

App-to-bank display stops at 50 candidates; generation stops at 100. Hidden-history display stops at 100. Link and bank-duplicate Undo histories show only the latest 30 decisions. None has paging. A valid row or old decision can become unreachable through its intended management screen.

**Fix:** bounded pages with counts, search and “Show more”; process later candidates without requiring false merges to clear earlier ones. Keep performance bounds. Roadmap **R05**.

**Evidence:** [review lists](../src/app/account-review.tsx), [candidate limits](../src/features/pocket/reconciliation.ts).

### A06 · Dirty forms can be dismissed without protecting the draft · P1 · Source

Subscription and savings modals close directly; car/report/import drafts live in component or in-memory state. No shared dirty-form navigation guard was found. An accidental Back, Close or process restart can lose work. Tab-mounted goal drafts surviving some tab changes do not establish recovery across restarts.

**Fix:** one discard/keep-editing pattern for changed forms, and deliberate resume/discard for lengthy import/report drafts. Do not persist raw PDFs or sensitive form values in route URLs. No warning for untouched forms. Roadmap **R06**.

**Evidence:** [subscription editor](../src/features/subscriptions/SubscriptionEditor.tsx), [savings sheet](../src/features/goals/SavingsAdjustmentSheet.tsx), [fuel form](../src/app/report-price.tsx), [batch memory](../src/features/bank/batch.ts), [cars](../src/app/cars.tsx).

### A07 · Batch balance selection is easy to lock before the desired choice · P1 · Source / usability issue

The batch defaults to keeping the existing balance. Saving any first file locks the batch choice. Importing a CSV first can therefore prevent choosing a later PDF's balance for that batch. This is intentional current behavior, not a silent overwrite bug, but the dependency is easy to miss.

**Fix:** an explicit batch-start step: keep balance, or choose one dated PDF. Show the choice before the first commit and why an older closing balance may be inappropriate. Preserve per-file review and no automatic balance replacement. Roadmap **R07**.

**Evidence:** [batch screen](../src/app/bank-batch.tsx), [batch state](../src/features/bank/batch.ts).

### A08 · Wipe completion is not visibly reported in Settings · P1 · Source

The erase service records a notice and remounts the app. Backup initializes its message from that notice; Settings → Data does not read it. A successful wipe started there can simply return to the default closed panel, without a clear completion summary. Interruption, reminder cleanup and widget cleanup also need device acceptance.

**Fix:** show a neutral completion screen or persistent success notice with the actual scope and a fresh-start action. Preserve the acknowledgement, exact typed phrase and final confirmation. Verify cleanup using disposable data only. Roadmap **R08**.

**Evidence:** [erasure service](../src/features/data/backupService.ts), [DataGate](../src/features/data/DataGate.tsx), [Settings Data](../src/app/settings/[section].tsx), [wipe panel](../src/features/data/EraseDataPanel.tsx).

### A09 · Missing originals make an attachment-inclusive backup fail as a whole · P2 · Source

A records-only restore intentionally retains missing-original metadata. Creating a later backup with attachments attempts to read every archived entry and referenced photo. One missing original/photo stops the operation; the fallback is to uncheck all attachments. Error messages exist, but there is no preflight inventory or choice to include the remaining available files.

**Fix:** preflight with available/missing/size counts; offer records-only or an explicitly declared partial attachment set compatible with restore validation. Never claim that missing files were backed up. Roadmap **R27**.

**Evidence:** [makeBackup / restoreBackup](../src/features/data/backupService.ts), [file I/O](../src/features/data/fileIO.ts), [backup UI](../src/app/backup.tsx).

## 2. Confusing or unnecessarily long flows

### A10 · Labels and Settings entry points have not caught up with the new hierarchy · P1 · Observed + Source

Settings is correctly a category list now. However, “Manage test mode in Settings” still opens the root instead of Subscriptions. The next page still says “Shortcuts & capture health,” “Recent purchase handoffs” and “User-invoked routines.” The last wording already confused the user. Technical build text is appropriately in About; keep it there.

**Fix:** direct links to the relevant subsection, “Optional quick actions,” and distinct names for statement sharing, Wallet capture and simple screen launchers. One canonical setup destination for each. Roadmap **R09**.

**Evidence:** [Settings routes](../src/app/settings/[section].tsx), [subscription entry](../src/features/subscriptions/SubscriptionsPanel.tsx), [shortcuts page](../src/app/automations.tsx).

### A11 · Hide, delete, duplicate exclusion and reset need clearer names · P1 · Source

“Remove from history” preserves the financial record; a separate “Delete purchase” can be visible inside its details. Trashing an import preserves transactions; removing a report preserves its Account charge. These rules are often explained, but too many different verbs appear together.

**Fix:** label the first action “Hide from history”; group financial edits separately from display/file actions. State the effect before each destructive action and link to its recovery location. Keep exact duplicate evidence intact. Roadmap **R10**.

**Evidence:** [transaction details](../src/features/pocket/TransactionRow.tsx), [purchase actions](../src/features/goals/PurchaseCard.tsx), [import library](../src/app/bank-imports.tsx), [report library](../src/app/report-receipt.tsx).

### A12 · Monthly renewal selection opens an unrelated full calendar · P1 · Observed + Source

A new monthly subscription displays “Day 1 of each month,” while its accessibility name says “Renewal date, 3/1/2026.” Opening it shows March even though this audit is in October. The code manufactures March/January to accommodate valid day numbers. It does not mean the actual renewal is in March, but the interaction suggests that.

**Fix:** a monthly day selector with a matching spoken label; yearly month/day and trial dates get their appropriate date controls. Roadmap **R11**.

**Evidence:** [subscription date construction](../src/features/subscriptions/SubscriptionEditor.tsx), [calendar label](../src/components/CalendarDateField.tsx).

### A13 · Report and trip screens expose too much setup at once · P2 · Source / Proposal

The combined report flow is a substantial improvement, but a simple pump-price report still sits among station identity, location, qualifier and time details. Trip planning exposes saved destinations, refill target and alternative-price economics before the basic car/fuel/destination decision is complete.

**Fix:** report: selected station → price/fuel/date → optional refill/photo/Account link. Trip: destination → car/fuel → result → optional plan tuning/economics. Preserve station identity review and fuel-range verification. Roadmap **R12**.

**Evidence:** [report form](../src/app/report-price.tsx), [trip form](../src/app/on-route.tsx).

### A14 · Budget percentages can be misleading for arbitrary ranges · P2 · Source

Insights displays a monthly-budget percentage even for a selected week, multi-month range or incomplete coverage. A note warns about meaning, but the percentage still looks comparable.

**Fix:** show that percentage only for the relevant calendar month, or explicitly calculate a separately labeled period budget; incomplete coverage stays visible. Add a clear remaining/over amount and link to underlying rows. Roadmap **R13**.

**Evidence:** [Insights](../src/app/insights.tsx).

### A15 · Several “view” actions open a broad list instead of the related record · P2 · Source

A fuel report's “View Account history” opens the unfiltered history, despite knowing the link ID. Similar repeated actions in review/Undo lists have indistinguishable labels without a merchant/date. Large histories make this unnecessarily hard.

**Fix:** deep link to and highlight the exact linked charge; retain a clear path back to the report. Add item-specific accessible action names and readable decision details. Roadmap **R14**.

**Evidence:** [fuel reports](../src/app/report-receipt.tsx), [Account review](../src/app/account-review.tsx), [history route](../src/app/account-transactions.tsx).

## 3. Accessibility findings

These are product acceptance targets, not a claim of formal accessibility certification.

### A16 · Small muted text needs stronger contrast · P1 · Source + measurement

The static theme's `muted` text (`#61756B`) on `paper` (`#F4F0E7`) measures **4.33:1**. It appears as small explanatory text on paper in several screens; this is below the 4.5:1 normal-text reference. The same text on `surface` measures 4.88:1, so this is background-specific. `lineStrong` against `surface` is 1.73:1; meaningful input/control boundaries need review rather than treating every decorative divider as a violation.

**Fix:** shared accessible foreground/background pairs and a contrast check for active controls, errors, selections and dark mode. Roadmap **R15**.

**Evidence:** [theme](../src/theme.ts), [Settings styles](../src/features/data/styles.ts), [Gas styles](../src/app/(tabs)/index.tsx).

### A17 · Calendar hit areas are too small on narrow screens · P1 · Observed + Source

Measured the same day button at **46.28 × 42 px** in a 390 px browser and **36.28 × 42 px** at 320 px. Day cells use seven equal columns and a 42-unit minimum height. Some station text actions also lack an explicit minimum target. A native 44-point target is the proposed product standard, not a claim that WCAG's minimum is universally 44.

**Fix:** use appropriate date/day selection layouts, sufficient target spacing, and larger action regions. Roadmap **R16**.

**Evidence:** [calendar](../src/components/CalendarDateField.tsx), [station actions](../src/components/GasStationCard.tsx).

### A18 · Headings, state announcements and focus behavior are inconsistent · P1 · Observed + Source / Device gate

Account and Settings have explicit heading roles; other visible page titles do not. The root stack creates an empty browser heading because `headerTitle` is blank. Some status/error text has live announcements and others does not. No shared explicit focus-return/error-focus policy was found. The modal framework does provide default behavior; native focus is not proven broken by this code search.

**Fix:** meaningful screen titles, heading hierarchy, state/disabled labels, first-error focus, modal focus/return acceptance and restrained status announcements. Never read sensitive balances automatically from notifications. Roadmap **R17**.

**Evidence:** [root navigation](../src/app/_layout.tsx), [subscriptions](../src/features/subscriptions/SubscriptionsPanel.tsx), [batch](../src/app/bank-batch.tsx), [forms](../src/components/FormScrollView.tsx).

### A19 · Large text and chart/map alternatives need a full acceptance pass · P1 · Source / Device gate

There are many fixed horizontal rows, two-line merchant titles, one-line account amounts and 10–13-unit helper labels. Defaults permit text scaling, which is good; that does not prove the layouts remain usable. Price charts have a useful summary label but no report-by-report text table. Gas already has a List alternative; preserve and improve it rather than making map gestures mandatory.

**Fix:** test the largest supported accessibility text sizes, 320 px/200% web text and screen-reader order; stack rows when needed, preserve full financial amounts, offer chart data and labeled map/list controls. Roadmap **R18–R19**.

**Evidence:** [Account layout](../src/app/(tabs)/pocket.tsx), [transaction rows](../src/features/pocket/TransactionRow.tsx), [price chart](../src/components/PriceHistoryChart.tsx), [map](../src/components/StationMap.tsx).

### A20 · Reduced motion and keyboard-only operation are unverified · P2 · Source / Device gate

Some navigation is deliberately unanimated, but modals still explicitly slide/fade and the map uses an embedded web surface. No app-level reduced-motion preference handling was found. Keyboard operation of calendars, map fallback, destructive confirmation and focus visibility has not been accepted.

**Fix:** follow OS Reduce Motion, keep all core tasks operable through focusable controls, and verify phone external-keyboard/web tab order. Roadmap **R20**.

## 4. Worthwhile additions and customization

These are proposals, not missing correctness work. Existing maps preference, fuel/radius/sort filters, reminders, suggestion caps, widget visibility and app lock already exist; do not add duplicates.

- **R21 — Appearance:** System/Light/Dark plus stronger contrast after shared color tokens are ready.
- **R22 — Start screen:** choose which of the four existing tabs opens first; preserve Gas as the existing default.
- **R23 — Remember views:** remember Gas Map/List and Subscriptions List/Calendar; show active gas filters clearly and offer Reset filters.
- **R24 — Reminder timing:** optional notification hour and renewal lead time; defaults stay familiar. Permission/scheduling status remains separate from preference.
- **R25 — Amount privacy:** optional hide-all-amounts-on-open, with explicit reveal; coordinate with widgets and app-switcher preferences.
- **R26 — History convenience:** period presets, date controls and an optional comfortable/compact row setting only if minimum target sizes survive.
- **R27 — Data health:** attachment preflight, storage usage, missing-source counts and last backup creation reminder. Never infer an external backup was actually saved from a share sheet opening.
- **R28 — Manual entry:** optional purchase date and explicit savings-rule choice; later a manual deposit/refund entry through the same signed movement model. Preserve current fast defaults.
- **R29 — Contextual setup/help:** a dismissible, skippable checklist for the features being used; searchable Settings keywords only if useful; hide empty legacy demo entry.
- **R30 — Evidence navigation:** a few readable charts/coverage labels and merchant categorization shortcuts, each backed by the existing records; no new general finance dashboard.

## 5. Native acceptance and performance

**R31–R34 are open gates, not unimplemented feature claims.**

- Installed iPhone Release build: cold launch with the computer off, offline local data, upgrade preserving identity and restore on a separate test installation.
- Citizens/Wallet/files: real supported layouts, zero activity, page-2 spending, deposits, identical legitimate purchases, renamed/overlapping statements, cold/warm share and interrupted save. Use authorized redacted fixtures; never put personal PDFs in Git.
- Reminders/privacy/OCR/checkout/widgets: actual permission grant/revoke, delivery/time zones, lock/fallback and app-switcher preview; receipt/scanned-statement recognition review; checkout rule/override/restart on supported browsers. Widgets only on a capable signed build. No real payment/cancellation is necessary for coverage tests.
- Scale: measure long history, archive and report libraries with synthetic data; cap memory and avoid slow whole-store recalculation during typing. Android native compilation/device acceptance remains separate if Android is part of actual use.

## Reference basis

For contrast, labels/state, keyboard/focus, text resizing and alternative input, use [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) as the web baseline. Native target size, adaptable text and assistive-technology behavior should follow [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility). Use [React Native accessibility documentation](https://reactnative.dev/docs/accessibility) for implementation details, checking the project's SDK-compatible APIs before coding. The measured app-specific failures above are independent observations, not compliance claims from those sources.
