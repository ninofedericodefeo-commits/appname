# GasFinder flows and navigation

**October 15, 2026.** These are the **target journeys** for the [final roadmap](../ROADMAP.md), not claims that every branch is already implemented. The [audit](APP_AUDIT_FINAL.md) distinguishes current behavior from proposed changes. Existing safety/reconciliation checks remain in every shortened flow.

## 1. Settings structure

The nine current categories remain the starting point. Controls live inside a category. General & appearance is a proposed tenth category only if its preferences are implemented; it should not be added as an empty destination.

```mermaid
flowchart LR
  S["Settings"] --> A["Account & statements"]
  A --> A1["Name, import setup, statement reminder, history preferences"]
  S --> G["Gas & cars"]
  G --> G1["Maps app, fuel, refill level, cars, saved view"]
  S --> U["Subscriptions"]
  U --> U1["Phone reminder status and timing, test subscriptions"]
  S --> V["Savings"]
  V --> V1["Suggestion switch and limits"]
  S --> W["Widgets"]
  W --> W1["Available widgets and amount visibility"]
  S --> P["Privacy"]
  P --> P1["App lock, preview protection, amount reveal"]
  S --> Q["Shortcuts & spending pause"]
  Q --> Q1["Optional quick actions, Wallet setup, checkout setup"]
  S --> D["Data & backups"]
  D --> D1["Backup, restore, export, account reset, wipe"]
  S --> B["About GasFinder"]
  B --> B1["Version, build capabilities, diagnostics"]
  S -.-> C["General & appearance — proposed"]
  C -.-> C1["System theme, start tab"]
```

**Rule:** a contextual “Manage reminders” or “Manage test mode” link opens its subsection, not the root list. Returning from a subsection restores the list position. Unavailable native capabilities explain the requirement inside their category.

## 2. Account amount and transaction review

Target for **R01–R05, R10, R25**. The confirmed balance is never silently replaced by a forecast or a duplicate decision.

```mermaid
flowchart TD
  O["Open Account"] --> B{"Saved bank snapshot?"}
  B -->|"No"| N["Show unknown amount; update balance or import statement"]
  B -->|"Yes"| E["Snapshot + eligible newer posted/logged movement"]
  E --> S["Subtract money set aside"]
  S --> A["Show dated available estimate; exclude pending"]
  A --> W["Why this amount? — trace the arithmetic"]
  A --> H["Transactions — newest first"]
  H --> D["Open transaction details"]
  D --> C["Correct direction/details or hide the row"]
  C --> V["Recompute shared projection; keep raw evidence"]
  V --> H
  A --> M["Possible matches and hidden-history review"]
  M --> R{"Same actual purchase?"}
  R -->|"Yes, explicitly confirmed"| L["Link or exclude duplicate; record decision and Undo"]
  R -->|"No"| K["Keep both; persist separate-purchase decision"]
  R -->|"Unsure"| T["Leave separate and review later"]
  L --> V
  K --> H
  T --> H
```

**Accounting invariant:** hiding affects visibility; matching affects which movements count; savings assignments remain explicit. A bank snapshot absorbs covered activity so it is not subtracted again.

## 3. Citizens statement or CSV import

Target for **R02, R04, R06–R07, R17, R32**. Citizens download/authentication remains in Citizens. Sharing is the shortcut; screen-launcher shortcuts are optional.

```mermaid
flowchart TD
  C["Citizens: open statement PDF"] --> S["Share or download"]
  S --> F["GasFinder receives file or user chooses PDF/CSV"]
  F --> B{"Multiple files?"}
  B -->|"Yes"| BC["Batch start: keep balance or choose one dated PDF"]
  BC --> P
  B -->|"No"| P["Read locally; validate file/account/layout"]
  P --> T{"Readable supported data?"}
  T -->|"No"| X["Explain issue; choose text PDF/CSV or reviewed on-device OCR"]
  X --> P
  T -->|"Yes"| R["Show spending, deposits, counts, source pages and reconciliation"]
  R --> Q{"Needs attention?"}
  Q -->|"Warnings, sign ambiguity or possible matches"| M["Review rows, directions and actual duplicate evidence"]
  Q -->|"Clean"| U
  M --> U{"Use this dated PDF balance?"}
  U -->|"Use"| UB["Stage closing balance; leave set-asides intact"]
  U -->|"Keep / no eligible balance"| KB["Stage history with existing balance"]
  UB --> Z["Confirm import"]
  KB --> Z
  Z --> J["Recoverable save: original + movements + decisions"]
  J --> OK["Summary: added, matched, excluded, balance choice"]
  J -->|"Save interrupted or failed"| RE["Recover committed state; keep or resume review"]
  OK --> A["Account and subscription evidence update once"]
  OK --> NEXT["Review next batch file, if any"]
```

**Rules:** mismatch cannot bypass the scanned-PDF gate; clean shared quick import still asks the balance question; an unchanged reimport adds nothing; two legitimate equal charges remain two. Batch setup must be completed before its first commit. Unsaved draft recovery must state exactly what was retained.

## 4. Savings and manual movement

Target for **R03, R06, R17–R18, R28**. A savings change is bookkeeping inside the bank balance.

```mermaid
flowchart TD
  G["Goals: Add money / Adjust savings"] --> D["Choose active goal or unassigned savings"]
  A["Account: Manage savings"] --> D
  D --> E["Add or lower; enter amount"]
  E --> P["Show destination, total set aside and available after saving"]
  P --> C{"User choice"}
  C -->|"Cancel"| K["Keep all amounts unchanged"]
  C -->|"Save"| V["Revalidate live balance, goal and limits"]
  V -->|"Valid"| S["Record assignment once; show confirmation"]
  V -->|"Changed or invalid"| ER["Explain at field; keep draft"]
  H["Transactions: Log movement"] --> M["Purchase now by default; optional date and rule choice"]
  M --> MR["Review signed movement and any set-aside effect"]
  MR --> MS["Save once; update estimate, not confirmed snapshot"]
```

**Dirty-form rule:** untouched Close is immediate; closing changed input offers Keep editing or Discard. No repeated confirmations for an ordinary small adjustment beyond its clear preview/save boundary.

## 5. Subscription setup, renewal and cancellation

Target for **R09, R11, R17–R18, R24, R33**. App selection is a supported installed-app catalog, not enumeration of every phone app.

```mermaid
flowchart TD
  A["Add subscription or review bank suggestion"] --> E["Name, expected price and recurrence"]
  E --> D["Monthly day or yearly month/day; optional trial date"]
  D --> B["Choose billing channel; optional associated app"]
  B --> S["Save reviewed subscription"]
  S --> R["Upcoming renewals and separate real cost totals"]
  R --> C{"Keep or cancel?"}
  C -->|"Keep"| K["Record decision for this renewal"]
  C -->|"Plan to cancel"| P["Record plan and open supported provider/billing destination"]
  P --> U["User completes cancellation with provider"]
  U --> F{"Cancellation completed?"}
  F -->|"Not yet"| FU["Set or review follow-up; subscription stays active"]
  F -->|"User confirms"| X["Mark canceled locally; retain history"]
  X --> BC["Review any later bank charge or possible refund"]
  R --> N["Optional phone reminder with permission and schedule status"]
  N --> R
```

**Samples:** test cards can exercise reviews, but real cost totals, bank evidence and phone notifications exclude them. The calendar must provide cancellation follow-up access or a clear direct link to it.

## 6. Gas search, report and drive

Target for **R12, R14, R18–R19, R23, R30, R33**. Price freshness and road evidence remain visible.

```mermaid
flowchart TD
  G["Gas"] --> A["Saved area, GPS or manual city/ZIP/coordinates"]
  A --> R["Stations with price or N/A; dated cache/freshness"]
  R --> V["Map or equivalent List"]
  V --> S["Select station"]
  S --> D["Directions in preferred Maps app"]
  S --> P["Report: prefilled station, price, fuel and observed date"]
  P --> O{"Add refill or receipt?"}
  O -->|"No"| SAVE["Save local report"]
  O -->|"Yes"| RF["Review gallons/total, optional photo/OCR and car"]
  RF --> L{"Account effect?"}
  L -->|"Report only"| SAVE
  L -->|"Existing charge"| EX["Choose exact charge; verify amount/date"]
  L -->|"New purchase"| NP["Preview and confirm new movement/rule"]
  EX --> SAVE
  NP --> SAVE
  SAVE --> H["Price history and recorded fuel costs; no double count"]
  G --> T["Trip: destination, selected car and fuel remaining"]
  T --> PLAN["Plan candidate stops"]
  PLAN --> EDIT["Optional stop changes, refill target and detour comparison"]
  EDIT --> CHECK["Verify routed legs and estimated safety margin"]
  CHECK --> OK{"Complete and within range?"}
  OK -->|"No / unknown"| WARN["Show gap; change plan or keep unverified"]
  WARN --> EDIT
  OK -->|"Yes"| MAP["Open Maps with verified stops; label assumptions"]
```

**Rule:** navigation support is not proof that a station is open or its pump price current. Edited stops invalidate earlier verification. Basic browsing/search never requires a Shortcut.

## 7. Backup, reset and wipe

Target for **R08, R17, R27, R31**. Different scopes must be visible before confirmation.

```mermaid
flowchart TD
  D["Settings: Data & backups"] --> B["Backup: preflight available/missing files and size"]
  B --> P["Password + confirmation; choose supported attachment scope"]
  P --> E["Create encrypted file; user saves externally"]
  D --> R["Restore: choose file, unlock and inspect"]
  R --> C{"Replace current records?"}
  C -->|"Cancel"| KEEP["Keep current data"]
  C -->|"Confirm"| J["Journal, restore and verify; local Undo available"]
  D --> A["Reset/switch account: show retained versus cleared data"]
  A --> AR["Backup acknowledgement + RESET confirmation"]
  AR --> AU["Reset account; local Undo available"]
  D --> W["Wipe: show permanent scope and backup option"]
  W --> WA["Acknowledge permanence"]
  WA --> WT["Type ERASE ALL DATA"]
  WT --> WF{"Final erase confirmation"}
  WF -->|"Cancel"| KEEP
  WF -->|"Confirm"| WE["Persist erasure marker; clear managed records and owned files"]
  WE --> V{"Cleanup verified?"}
  V -->|"No / interrupted"| REC["Block writes; retry cleanup at startup"]
  REC --> WE
  V -->|"Yes"| DONE["Completion summary and fresh start; no Undo"]
```

**Scope:** external exports/Files/iCloud copies and device lock settings remain. Opening a share sheet is not proof an external backup was saved. Never erase the actual user's data just to accept the flow.
