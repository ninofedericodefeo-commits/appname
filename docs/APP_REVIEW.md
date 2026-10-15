# App review — October 13, 2026

The [future roadmap](../ROADMAP.md) turns this audit and existing feature plans into a phased personal-use backlog, with dependencies and completion gates. App Store publication is outside the plan.

## Implementation progress — October 14

The first implementation batch addressed data foundations in findings 1–7. The second batch simplified goal/subscription actions; the third addresses Gas search and control placement:

| Finding | Implemented | Remaining scope |
| --- | --- | --- |
| 1 | Dated confirmed snapshot plus a reconciled estimate from newer posted/logged activity; consistent savings caps and Account widget value. | Live bank synchronization is not implemented. |
| 2–3 | Stable identity across renames, one linked account, statement ownership guard, linked-history view with older-history access. | Full multi-account balances are not implemented; CSV account ownership needs user review. |
| 4 | Per-period summary totals and opening-to-closing checks, visible status, manual mismatch acknowledgment and quick-import review. | Unreadable fields remain unverified; OCR and new layouts need separate work. |
| 5 | Newest source wins per fuel, Old pins, recent-only price sorting/lowest-price/drive comparisons. | Shared community prices/backend remain planned. |
| 6 | Suggestions use the full corrected bank ledger, including history-only imports and legacy bank-confirmed purchases. | Classification remains conservative and reviewable. |
| 7 | Price-change and charge-after-cancellation review alerts with persistent per-charge dismissals. | Billing-date mismatch detection remains planned. |
| 8 | Shared direct savings sheet with destination/limits/preview; goal editor only saves its draft; one purchase entry through Transactions. | Phone keyboard/accessibility acceptance. |
| 9 | One universal gear; suggestion/widget preferences in Settings; named Goal actions with inline archive/delete confirmation. | Broader shared-component polish. |
| 10 | Area/GPS/error state and Filters above the retained map, permission-free submitted place/coordinate search, explicit map-area search, recent areas/saved stations, dated result caches and compact My cars. | Native GPS/gesture/keyboard and airplane-mode cold-launch acceptance. |
| 12 | Explicit sample mode, normal-mode exclusion and no sample phone notifications; nonmodal renewal banner, durable two-hour/midnight snoozes and visible return time. | Physical-phone restart/foreground acceptance. |
| 13 | Read-only permission/actual schedule status, refresh, permission request and phone-settings actions; resync on foreground. | Permission revocation, actual delivery and time-zone checks on the phone. |
| 17 | Goals page/title match; legacy demo link moved to Settings → Data; shared savings buttons. | Optional setup checklist and remaining appearance cleanup. |

Verification: 223 logic tests, lint, TypeScript and iOS/Android/web exports pass. First-batch mobile checks covered rename/reimport, mismatch gating and balance estimates. Second-batch checks verified savings actions, snoozes, sample isolation and universal Settings. Third-batch 390/320 px browser checks covered GPS-unavailable fallback, public city lookup/cached reuse, coordinate bounds, recent areas, station saving/distances, restart with dated results, explicit map-area search and unpriced-filter recovery. Phone-specific behavior remains a device gate.

Findings 11 and 14–16 remain open, alongside the remaining scope above and documentation/appearance cleanup. The review below records the original audit state; implementation changes above take precedence.

## Scope and conclusion

Reviewed the mobile-width Gas, Account, Goals, Subscriptions, Settings and statement-setup screens, the main data flows, and the feature plans. Lint, TypeScript and all 179 existing logic tests pass. Two additional read-only synthetic checks reproduced the nickname/deduplication problem and stale local-price precedence. Passing the current tests does not resolve these product gaps.

No application behavior was changed for this review. Native phone behavior, real provider-app launches, live Amazon extraction and browser payment interception were not reverified. The browser used existing synthetic test data; no original bank PDFs were uploaded or changed.

The main weakness is confidence in the numbers: a saved account snapshot can look current, importing depends on editable nicknames, and old gas prices can look preferable to newer reports. The next work should improve those foundations and simplify daily actions before adding more surfaces.

Priority: **High** affects balances, duplicates or price comparisons; **Medium** affects a main flow or feature usefulness; **Low** is cleanup or polish. These are proposed priorities, not changes already approved for implementation.

## Accuracy and data consistency

### 1. Available to spend is not maintained after spending — High

The account value is saved bank balance minus set-aside. Logging a manual/Shortcut purchase adds a history record and possibly savings, but does not subtract the purchase from the bank snapshot. New deposits also do not roll the snapshot forward. The small statement date is helpful, but “Current balance” and the large available amount still suggest a more current view than the data supports.

**Improve:** put the balance date beside the main figure, indicate when newer transactions exist, and distinguish the confirmed bank snapshot from any estimated balance after subsequent transactions. Any estimate needs reconciliation when the next statement arrives so statement spending is not deducted twice.

Evidence: [`pocket.tsx`](../src/app/(tabs)/pocket.tsx), [`addPurchase`](../src/stores/pocketStore.ts), [`accountImport.ts`](../src/features/bank/accountImport.ts).

### 2. Renaming an account can duplicate its imported transactions — High, reproduced

Both purchase and bank-history identities include the account nickname. A synthetic reimport under “My checking” instead of “Checking” produced different IDs and was not recognized as a duplicate, even with the original purchase/key supplied. The setup warns that changing a nickname starts another history, but a display-name edit should not create another financial account.

**Improve:** use a stable local account ID, associate the PDF account identifier where available, and keep the nickname editable independently. CSV should choose an existing account. Changing banks and renaming one bank should be distinct actions.

Evidence: [`importLogic.ts`](../src/features/bank/importLogic.ts), particularly identity creation and account matching; [`statement-automation.tsx`](../src/app/statement-automation.tsx).

### 3. Account nicknames imply more account support than exists — High

Transactions can carry multiple account labels, but there is one global balance and one set-aside total. Applying a second account's statement replaces that global balance rather than maintaining a separate account. The summary still says “My account.”

**Improve:** either explicitly restrict setup to one account and warn on a different statement, or add account selection with a balance/history scoped to each account. Do not mix checking and savings histories under one unlabeled balance.

Evidence: [`pocketStore.ts`](../src/stores/pocketStore.ts), [`accountImport.ts`](../src/features/bank/accountImport.ts), [`pocket.tsx`](../src/app/(tabs)/pocket.tsx).

### 4. PDF import needs a stronger completeness check — High

The parser identifies text-table rows, directions, dates and closing balances, and reports some unreadable rows. It does not reconcile parsed credits/debits with the statement's opening balance and section totals. Recognizing a closing balance does not establish that every spending row was read. This matters given the earlier missing-page and direction issues.

**Improve:** when the statement provides the information, compare parsed counts/totals and check opening balance plus credits minus debits against closing balance. Show “matched,” “mismatch” or “cannot verify,” with a concise deposit/spending summary before import. Keep manual review for mismatches.

Evidence: [`citizensStatement.ts`](../src/features/bank/citizensStatement.ts), [`bank-import.tsx`](../src/app/bank-import.tsx). This is a missing verification mechanism, not a claim that the previously repaired October PDF currently fails.

### 5. Old local gas reports override newer provider prices — High, reproduced

`withLocalPrices` always puts a linked local report ahead of the provider's price for that fuel. A synthetic January report at $2.10 replaced an October provider report at $3.50. Sorting, price-only filtering and cheapest selection do not exclude stale values. Cards show freshness information, but map pins do not, so an old bargain can still dominate the map.

**Improve:** compare timestamps and sources before choosing a displayed price. Make stale pins visibly different and separate “lowest recent report” from historical prices. Stale values should not silently win current price comparisons.

Evidence: [`localPrices.ts`](../src/features/stations/localPrices.ts), [`logic.ts`](../src/features/stations/logic.ts), [`GasScreen`](../src/app/(tabs)/index.tsx), [`GasStationCard.tsx`](../src/components/GasStationCard.tsx).

### 6. Subscription suggestions are disconnected from some bank history — Medium

Suggestions use imported purchase records, not the full account ledger. Importing a movement into history without creating a purchase does not provide that evidence. Correcting a history row's direction also leaves the purchase-based suggestion input unchanged.

**Improve:** derive subscription evidence from one reconciled bank transaction source, respecting corrections and transfer/refund classification. Preserve the intentional distinction between hiding a row and deleting its underlying evidence.

Evidence: [`SubscriptionsPanel.tsx`](../src/features/subscriptions/SubscriptionsPanel.tsx), [`bankSuggestions.ts`](../src/features/subscriptions/bankSuggestions.ts), [`TransactionRow.tsx`](../src/features/pocket/TransactionRow.tsx).

### 7. Existing subscriptions are not monitored against new statements — Medium

Existing merchants, including subscriptions marked canceled, are suppressed from suggestions. That avoids repeated setup suggestions, but it also means bank imports do not highlight a price increase or a new charge after “I canceled it.”

**Improve:** keep duplicate setup suggestions suppressed, but separately compare new charges with saved subscriptions. Offer review of changed prices, posting-date differences and charges after reported cancellation. Do not silently change the user's subscription details.

Evidence: the `existing` merchant set in [`bankSuggestions.ts`](../src/features/subscriptions/bankSuggestions.ts).

## Flows that are redundant or harder than necessary

### 8. Adding money to a goal is buried inside Edit — Medium

Goal contributions, lowering goal savings and logging purchases live inside the goal editor. Some actions save immediately while “Save goal” and “Cancel” apply to the other fields. Account has another set-aside form, but it manages unassigned savings and sends people back to Goals to lower goal savings.

**Improve:** expose Add money/Adjust savings as a direct action with an explicit destination: active goal or unassigned money. Keep goal editing for name, target, deadline and rule. Use one primary purchase-logging flow rather than nested copies.

Evidence: [`GoalsPanel.tsx`](../src/features/goals/GoalsPanel.tsx), [`GoalEditor.tsx`](../src/features/goals/GoalEditor.tsx), [`pocket.tsx`](../src/app/(tabs)/pocket.tsx).

### 9. Goals has two settings gears — Medium, seen in the walkthrough

The universal toolbar gear and the separate Goal settings gear look alike. Account widget settings are in universal Settings while Goal widget settings are inside the second gear. This conflicts with the intended universal settings pattern.

**Improve:** retain one universal gear per page. Put global suggestion/widget preferences in Settings; use an explicitly named goal menu for goal-specific actions such as finishing or archiving.

### 10. Gas filters and location errors appear too late — Medium

The map, action buttons and full My cars card come before Filters and the location error. Without GPS, the first screen shows a broad map with zero stations; the explanation is below the initial viewport. There is no city/ZIP or search-this-area fallback.

**Improve:** show the location state above the map, put fuel/radius/price-only controls near it, and keep car selection compact until planning a drive. Add a manual search location. The requested Leaflet map can remain.

Evidence: [`GasScreen`](../src/app/(tabs)/index.tsx), [`MyCarsSection.tsx`](../src/features/vehicles/MyCarsSection.tsx).

### 11. Price reporting and receipt reporting repeat work — Medium

They have separate entry points and overlapping station/fuel/price details. A receipt photo is stored but not read, so taking a photo does not reduce typing. Standalone reports can also lack a reliable link to a mapped station.

**Improve:** one Report price flow with station selection and an optional receipt attachment. Keep photo-only reports clear about manual entry until the planned reviewed OCR exists.

### 12. Sample renewals interrupt normal app use — Medium

Samples are useful for the requested testing, but they participate in the same tomorrow totals, full-screen review and phone reminder scheduling as real subscriptions. “Review later” is reset on foregrounding, so it can reappear when returning to the app the same day.

**Improve:** keep samples available through an explicit test mode and exclude them from ordinary financial summaries/reminders outside it. Use a durable snooze and a less intrusive renewal banner. The current sample setup can remain while testing.

Evidence: [`_layout.tsx`](../src/app/_layout.tsx), [`samples.ts`](../src/features/subscriptions/samples.ts), [`reminders.ts`](../src/features/subscriptions/reminders.ts).

### 13. Reminder preference can disagree with phone permission — Medium

The switch displays the persisted app preference. Scheduling silently returns when OS notification permission is off, without updating the switch or showing that delivery is blocked.

**Improve:** distinguish wanted/enabled from permission granted and notifications scheduled; check permission when Settings resumes and offer a clear route to phone settings. This finding comes from code inspection, not a reproduced permission change on a phone.

### 14. Saved imports are not a complete data-management feature — Medium

Saved files can be reviewed or shared individually, but there is no in-app rename/delete or bulk export. There is also no app-level backup/restore for goals, contributions, subscription choices, corrections and settings. Retaining PDFs alone cannot reconstruct all those decisions.

**Improve:** archive management plus a versioned export/restore that includes the financial records and their settings. Treat deleting an archived original separately from removing imported transactions.

Evidence: [`bank-imports.tsx`](../src/app/bank-imports.tsx), archive storage interfaces, persisted stores and [`settings.tsx`](../src/app/settings.tsx).

### 15. Checkout pause has a substantial setup and coverage gap — Medium

The app reports Safari extension availability/enabled state, not whether a checkout pause is active. Shops and deadlines are controlled inside the browser. Chrome support is desktop-only, which does not cover Chrome shopping on the phone. Its setup refers to a supplied extension folder but the app provides no download/install handoff.

**Improve:** make supported devices obvious before setup, provide the desktop package through an accessible handoff, and clearly label where a pause is controlled. Keep recognized-checkout coverage distinct from a complete payment block. A phone Chrome extension cannot be promised by reusing the desktop build: Google's phone installation flow is [Add to Desktop](https://support.google.com/chrome_webstore/answer/2664769?hl=en).

Evidence: [`spending-blocker.tsx`](../src/app/spending-blocker.tsx), [`SPENDING_PAUSE.md`](SPENDING_PAUSE.md).

### 16. Subscription cancellation help is only a starting point — Medium

The picker supports 14 catalog apps, not every downloaded app, and most launch links open the provider's home screen rather than cancellation settings. The main recurring-cost view is a date-sorted list and tomorrow's total; there is no real-subscription monthly/yearly cost summary.

**Improve:** test the catalog on devices, provide known billing destinations and concise provider instructions where necessary, and show upcoming 7/30-day charges or monthly equivalent separately from annual bills. Expand supported apps as needed without claiming complete iPhone app enumeration. Opening the app must continue to leave actual cancellation to the user.

### 17. Naming and old demo surfaces need cleanup — Low

The tab says Goals while the page says Savings, the product says GasFinder while much of it is an account tool, and “Previous investing demo records” remains on the main Goals page. Several forms still use different button definitions despite Subs now using consistent buttons.

**Improve:** choose stable page/action names, move historical investing records into Settings → Data, and extend the subscription button consistency to shared forms. Preserve real legacy records. Add a short setup checklist so statement import, a goal and optional car/reminders are easy to discover.

### 18. Current-state documentation contradicts itself — Low

Examples: receipt docs still mention a fake $9.99 placeholder; older phone checks describe the reverted vector map; the handoff both describes pasting CSV and says it was removed. Some older verification gates were addressed later but remain in the top-level summaries.

**Improve:** maintain one concise current feature/status table, with older decisions in a separate changelog. This will make “already planned” distinct from implemented, deliberately removed and merely proposed work.

## Features already planned, requested or partially implemented

| Area | Current status | Useful next step | Existing reference |
| --- | --- | --- | --- |
| Amazon goals | Name/price lookup exists; successful live extraction is not established by the fixture tests. Product images and an optional Safari helper are future work. | Verify real direct/short links and the fallback first; add images or a share helper after the basic lookup is reliable. | [Amazon plan](AMAZON_GOALS_PLAN.md) |
| Citizens import automation | Shared-PDF handoff exists. Login/opening the statement remains manual. A newest-file/folder action is proposed, not committed as a finished feature. | Reduce handoff friction, verify both balance choices on a phone, and consider folder ingestion if direct Share is insufficient. Background bank downloading is not implemented. | [Citizens plan](CITIZENS_IMPORT_PLAN.md) |
| Receipt OCR | Not implemented; all fields remain manual. | Suggest station/fuel/price/gallons/total from the photo, retaining review before saving. | [Receipt plan](RECEIPT_REPORTS.md) |
| Shared gas prices | Default OpenStreetMap parsing supplies locations with empty price arrays. Local reports stay on the device; the optional provider backend is not a ready shared community feed. | Decide on a verified provider/community feed; build timestamped, corrected reporting before presenting broad price coverage. | [Receipt plan](RECEIPT_REPORTS.md), [online stations](ONLINE_STATIONS.md) |
| Widgets | Account and Goal widget code exists, but the default Personal Team build gates the needed App Groups capability. | Settle the supported build/signing path and verify real rendering, privacy and freshness. This is not currently a usable free-team widget feature. | [Widget notes](SPENDING_PAUSE.md), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/) |
| Live Activity | Removing the waiting list removed its startable activity. The remaining factory only dismisses old activities. | Decide whether a useful new activity is wanted; do not advertise an active Live Activity feature or restore the removed waiting list by accident. | [Widget notes](SPENDING_PAUSE.md), original widget/Live Activity request |
| Installed-app picker and other native flows | Code/configuration exists, but the repository still records physical-device gates; Android Kotlin compilation is also unverified in this environment. | Finish device checks for detection/launch, notification delivery, document sharing, maps handoff and browser interception. | [App picker](SUBSCRIPTION_APPS.md), [phone checklist](PHONE_SMOKE_TEST.md) |

Scanned PDFs, credit-card statements and additional banks are current unsupported cases. The docs identify the limitation, but do not establish a firm implementation commitment; treat them as possible later scope rather than an already scheduled feature.

## Recommended order

1. **Account/import integrity:** stable account IDs, ownership guard, prominent balance date and statement reconciliation.
2. **Price/subscription consistency:** freshness-aware gas prices, corrected ledger evidence and checks for changed/post-cancellation charges.
3. **Daily usability:** direct savings actions, one settings pattern, usable no-GPS state, durable snooze and managed sample mode.
4. **Data management and device verification:** backup/restore, archive controls and native acceptance checks.
5. **Planned expansion:** reliable live Amazon lookup, reviewed receipt OCR and a real shared gas-price strategy; then images/helpers/widgets where the platform/build supports them.

The existing four tabs, restored map, shared transaction history, explicit PDF balance question and inline subscription deletion are useful foundations. The removed waiting list and paste-CSV page should stay removed.
