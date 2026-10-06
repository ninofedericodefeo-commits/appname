# GasFinder Product Roadmap

## Purpose

This roadmap describes the current app and the remaining work in staged order:

1. Bring the restored Gas, Savings, Money, and Activity experience to a reliable, testable baseline.
2. Keep personal data private and local-first, with explicit import, review, persistence, and deletion behavior.
3. Validate physical-device behavior and decide whether any online gas-data source is suitable.
4. Defer account linking, money movement, and investing integrations unless separately approved.

The app is private and single-user. This roadmap does not authorize bank linking, FinanceKit, a shared backend for personal data, or any movement of funds. It is a product direction, not a promise that every idea is technically available on every platform.

## Where the app is today

GasFinder is an Expo/React Native mobile app with grouped **Gas**, **Savings**, **Money**, and **Activity** navigation. Savings includes goals and Pocket; Money includes Spending Pause, subscriptions, and on-device bank-history CSV import. The previous simulated investing ledger remains in a read-only archive.

Gas opens in clearly labeled Philadelphia sample mode and does not request location on launch. Location is requested only when the user chooses a nearby search. Station sources include retained local fixtures and service integrations, but no production source has passed the coverage, freshness, terms, and operating-readiness gates. The app does not connect to a bank, card, or brokerage, detect transactions automatically, transfer funds, or execute trades.

### Implemented locally so far

- Savings goals, the on-device pocket, spending pause, and subscriptions are local user-managed workflows. Any balance or avoided-spending amount is an estimate and must not imply money has moved or a payment has been blocked.
- An optional, on-device purchase-pause planner lets users set a 24-hour, 2-day, or 7-day delay and self-report whether they bought or skipped a planned online purchase.
- The purchase-pause feature does not monitor accounts, intercept checkout, or block transactions. Its skipped-purchase total is an unverified user-reported estimate, not confirmed savings.
- Personal finance data is persisted locally. This does not make estimates verified balances or suitable for financial decisions.
- The gas screen separates the labeled Philadelphia sample from opt-in nearby/service search. Location permission is requested on demand; online search validates service data and surfaces errors rather than substituting sample results.
- Local ledger entries can be filtered by date and removed with balance-safe corrections; purchase-pause records can be deleted. Physical-phone verification is tracked in `docs/PHONE_SMOKE_TEST.md`.
- A mobile receipt-report flow now stores a photo and user-confirmed fuel price, fuel type, date, and station address or on-site GPS on the device. It does not extract receipt text or publish prices to other users. Shared prices require an authenticated backend, duplicate checks, moderation, retention rules, and a plan for handling false reports.
- A separate savings pocket now earmarks part of a manually entered account balance on this device. It is an estimate within the user's existing account; it cannot verify, transfer, or restrict bank funds. This matches the requested no-bank-connection scope.
- One active savings goal can use all or none of an existing pocket amount, accept confirmed set-asides, and show suggestions based on manually logged purchases and an optional deadline. An optional iPhone widget shows goal progress, with amounts hidden by default. Neither goals nor the widget represent a verified balance or an investment.
- A local subscription tracker now records monthly or yearly renewal dates and user-entered prices. It prompts for each renewal on the preceding calendar day and can schedule optional local 9 AM notifications. A plan-to-cancel decision is a reminder to act with the provider, not a cancellation or blocked charge.
- Bank-history CSV files are selected and processed on-device. A parsed import now has an explicit preview and confirmation step before persistence. Possible recurring-charge suggestions show match evidence and can be dismissed/restored; they remain inferences, not confirmed subscriptions or live account data.

## Product principles

- **Solve demonstrated user problems.** Use competitor research as evidence gathering, not as a reason to copy a product.
- **Be explicit about data quality.** Show whether prices are current, approximate, stale, or unavailable.
- **Ask before moving money.** Explain the amount, destination, and timing before any real transfer or investment.
- **Separate estimates from money.** A spending estimate, a pending contribution, cash held by a partner, and an investment’s market value are not interchangeable.
- **Make money features optional and controllable.** Users should be able to configure, pause, cancel, export, and understand them.
- **Use appropriate safeguards.** Provider approval, security, privacy, customer support, and legal/compliance review are release gates for real financial activity.

## Roadmap overview

| Priority | Workstream | Outcome |
|---|---|---|
| 1 | Documentation and implementation baseline | Roadmap, routes, source map, and smoke checklist describe the same current app |
| 2 | CSV import and recurring suggestions | Basic preview-before-save and dismissible evidence-based suggestions are implemented; broaden format/row review and lifecycle tests |
| 3 | Local-data lifecycle | Define and test persistence, migration, export, deletion, and recovery for local user data |
| 4 | Physical-device validation | Verify permissions, navigation, storage, reminders, import, accessibility, and failure states on agreed devices |
| 5 | Gas data readiness | Select a source only after coverage, freshness, terms, cost, and operating requirements are verified |
| Deferred | Account linking or real-money integrations | Requires a separate explicit product decision and appropriate provider, privacy, security, and legal review |

The current local workflows remain available while these gates are completed. Keep the sample records until each replacement is mapped, validated, and covered by tests. Do not infer approval for bank linking or FinanceKit from the presence of CSV import.

---

## 1. Research gas apps and improve GasFinder

### Goal

Find specific problems people encounter when locating fuel, comparing prices, and deciding where to stop. Turn validated findings into original improvements to GasFinder.

### Activities

1. Select a small set of relevant gas-price, navigation, and fuel-rewards apps.
2. Review publicly available app-store descriptions, release notes, ratings, and user reviews. Test apps directly where access is available.
3. Organize observations by user task, such as:
   - Finding stations near the user's current location or along a route.
   - Comparing prices by fuel type and understanding how recently a price was reported.
   - Filtering stations by distance, amenities, hours, and accessibility.
   - Getting directions and recovering from missing or inaccurate data.
   - Understanding rewards, discounts, and any conditions attached to them.
4. Maintain an opportunity log with:
   - Source and date reviewed.
   - User problem and evidence (including counterexamples).
   - Who is affected and how often it may occur.
   - Proposed GasFinder response and its differentiation.
   - Data, privacy, platform, and maintenance dependencies.
   - A low-cost way to test whether the fix helps.
5. Prioritize using user impact, strength of evidence, confidence, implementation/operational cost, and risk.
6. Revisit priorities as new reviews, usage observations, or user interviews add evidence.

### Deliverables

- A competitor and user-problem inventory.
- A ranked opportunity backlog with supporting evidence.
- A short product brief for each approved improvement, including acceptance criteria.

### Acceptance criteria

- The leading opportunities cite specific evidence and are not based only on a competitor feature existing.
- Each proposed improvement has a testable user outcome.
- Research records sources and distinguishes observation from interpretation.
- No proprietary text, visual assets, or distinctive interface expression is copied.

### Decision gate

Do not commit to a feature solely because it appears in another app. Confirm that the underlying user problem fits GasFinder's intended audience and can be addressed sustainably with available data.

---

## 2. Test on a physical phone

### Goal

Make the current prototype dependable to install and use on a real phone before relying on it for online data or financial workflows.

### Activities

1. Confirm the target platforms/devices and minimum supported OS versions; record the model, OS, build, tester, and date for each run.
2. Create and install the appropriate Expo development build on the target phone. Use a development build when Expo Go does not include a required native module.
3. Test the current local-data experience:
   - First launch, reload, and app restart.
   - Location permission granted, denied, unavailable, and later changed in Settings.
   - Gas, Savings, Money, and Activity tabs, plus access to secondary screens and return navigation.
   - Small screens, text scaling, keyboard appearance, and touch target sizes.
   - Goals, Pocket, Spending Pause, subscriptions, local reminders, and persisted user data.
   - CSV selection, preview, cancellation, confirmation, duplicate handling, and local deletion.
   - Slow/no connectivity and readable loading, empty, and error states.
4. Record OS/device, steps, expected and actual result, severity, and a screen recording or screenshot when useful.
5. Keep a smoke-test checklist for each build and retest fixes on affected platforms.
6. Use only sample/test data for mobile UI testing. Do not use real payment credentials or customer funds in a prototype.

### Deliverables

- A defined device/platform support matrix.
- A repeatable phone-install and smoke-test guide.
- A prioritized device-issue backlog and regression checklist.

### Acceptance criteria

- The app installs and opens on every agreed target test device.
- Grouped navigation and core local workflows work after reload and restart.
- Launch does not request location; choosing nearby search explains and handles granted, denied, unavailable, and later-changed permission states.
- Sample results remain explicitly labeled and are never presented as online/provider results.
- CSV data is not persisted until the user confirms the preview; cancellation leaves existing history unchanged.
- Text, buttons, inputs, and confirmation steps remain usable on small screens and with accessibility settings.
- Critical issues found during smoke testing are resolved or explicitly documented before the next release step.

---

## 3. Bring gas information online

### Goal

Replace or supplement sample station records with a dependable online source for real station locations and, if available, fuel prices.

### Activities

1. Treat station locations and fuel prices as separate data needs; a location database may not provide prices.
2. Evaluate candidate providers for:
   - Geographic coverage and accuracy in the intended initial area.
   - Price freshness, source, reporting process, and update frequency.
   - Permitted use, attribution, retention, and redistribution.
   - Free-tier limits, pricing at expected usage, rate limits, and service guarantees.
   - Whether the provider supports mobile-app display and the planned commercial model.
3. Select one initial geography and define what qualifies as a usable result there.
4. Define the mobile-to-backend API contract. Keep private provider credentials on the backend, not in the mobile bundle.
5. Add caching, request limits, monitoring, data validation, and clear handling for provider timeouts or missing prices.
6. Preserve a clearly labeled local demo mode so product work and testing can continue when the service is unavailable.
7. Show source and freshness for prices; never present missing or stale data as current.

### Deliverables

- Provider comparison and documented licensing/attribution decision.
- Backend/API contract and environment setup guide.
- Initial geography launch criteria and operational monitoring plan.
- Online and demo-mode acceptance test cases.

### Acceptance criteria

- Station and price records meet defined coverage and freshness thresholds in the selected area.
- The UI identifies unavailable, stale, and current price information accurately.
- Provider failure produces a useful error or clearly labeled demo state, not fabricated success.
- Credentials are not exposed in the client application.
- Attribution and provider terms are satisfied.

### Decision gate

Do not switch the app to production online data until the data source's terms permit the intended use and the product has an owner for outages, cost monitoring, and data-quality reports.

---

## 4. Maintain trustworthy Savings estimates

### Goal

Continue validating the implemented Goals and Pocket workflows. Help users understand user-entered and derived amounts without implying that money moved, was verified by a bank, or is guaranteed savings.

### Define the numbers first

The interface and data model should distinguish:

- **Potential contribution:** a proposed amount not yet accepted or transferred.
- **Authorized contribution:** an amount the user approved, but which may not have settled.
- **Settled contribution:** a confirmed amount received by the appropriate provider.
- **Cash balance:** funds held by an identified account provider.
- **Investment value:** current value reported by a brokerage/custodian and subject to market movement.
- **Withdrawal or sale proceeds:** a requested, pending, or completed withdrawal/sale.
- **Avoided spending:** an estimate based on a user-defined counterfactual; it is not the same as cash saved.

### Activities

1. Keep local records itemized and clearly distinguish user-entered, calculated, and fictional sample values.
2. Show contribution date, purchase or trigger reference, selected rule, calculated amount, and local status.
3. Add clear totals for contributions, withdrawals, and current balance; keep them separate.
4. Plan for duplicate transaction events, pending-to-posted changes, refunds, reversals, corrections, and provider reconciliation.
5. Provide a transaction detail view, date filtering, export, and a way to correct or remove user-entered demo data.
6. Do not add a financial provider unless the user explicitly changes the current no-bank-connection scope and all provider/privacy/legal gates are met.

### Deliverables

- A shared definition of each displayed financial metric.
- A transaction-ledger data model and screen design.
- Reconciliation, correction, refund, reversal, export, and deletion behavior.

### Acceptance criteria

- Users can trace every displayed total to itemized activity.
- Pending, settled, withdrawn, estimated, simulated, and market-valued amounts are not combined ambiguously.
- Transaction duplicates and reversals do not silently inflate balances.
- Users can understand where a real balance is held and which provider reports it.

---

## 5. Validate local Money tools and imported transaction suggestions

### Goal

Continue validating Spending Pause, subscriptions, and possible recurring-charge suggestions. These are user-managed/local tools; imported CSV history is not a live feed, and suggestions are not confirmed subscriptions.

### Remaining work

- Add review-before-persist for CSV imports, with clear valid/skipped-row counts and a cancel path.
- Improve recurring-candidate evidence and confidence; allow explicit dismissal and correction, and never add a subscription without user action.
- Validate reminder timing, edits, duplicate imports, false positives, variable amounts, sparse transaction history, and data deletion.
- Keep discovery open for improvements, but do not expand transaction monitoring or payment controls in the current scope.

### Existing boundaries

- Spending Pause is an optional self-reporting planner. It does not detect, intercept, or block purchases.
- Subscriptions are user-entered reminders; a plan-to-cancel reminder does not cancel with a provider.
- CSV import accepts user-selected files and processes them on-device. It does not sign in to, sync with, or connect to a bank.

### Guardrails

- Every feature is opt-in, plainly explained, and easy to pause or disable.
- The app does not shame users or use dark patterns to steer them toward a financial product.
- Do not claim to prevent a purchase unless a specific supported integration actually has that capability and the user explicitly enabled it.
- Minimize transaction data collection and explain retention and deletion behavior.
- Provide a way to adjust rules and correct incorrect categories or imported transactions.

### Deliverables

- User-research summary and selected problem statement.
- Tested prototype for the most useful low-risk intervention.
- Privacy/data-minimization plan and user-controlled settings.

### Acceptance criteria

- Users can state what each intervention does before enabling it.
- A user can pause, disable, and edit it without contacting support.
- Usability testing shows that the feature supports the user's stated goal and does not unexpectedly interfere with payments.
- Any spending estimate is clearly identified as an estimate.

### Decision gate

Do not build broad account monitoring or transaction blocking before validating user demand, privacy impact, technical feasibility, and platform/provider terms.

---

## 6. Deferred: assess account, payment, cash, or investment integrations

### Goal

This workstream is not approved or part of the current private, local-first scope. Do not begin provider selection or implementation unless the user explicitly changes scope. If that decision is made later, determine feasibility before implementing any user-authorized flow, and require qualified providers and reviewed operational controls.

### Keep the product choices distinct

These are different capabilities and should not be described as one generic “connect an account” feature:

1. **Transaction visibility:** a provider may share eligible account transactions after they occur.
2. **Prompt after a transaction:** the app may notify a user after an eligible transaction is posted and ask whether they want to make a separate contribution. The prompt does not change the completed purchase.
3. **Separate contribution transfer:** moving money requires a supported transfer provider, clear user authorization, limits, and handling for failures/returns.
4. **Cash holding:** customer money must be held through an appropriately structured financial partner and account arrangement.
5. **Investing:** brokerage/custody, trade execution, disclosures, and the investment service model must be established with appropriate partners.
6. **Charging at checkout or issuing a card:** applying an added amount at purchase time requires control of that payment flow or a supported issuing/payment program. Linking an existing account does not provide this power.

### Activities and gates

1. Select a single initial flow (for example, read transaction data and ask the user to authorize a separate contribution); document explicitly what it will and will not do.
2. Evaluate transaction-linking, money-movement, cash-account, or brokerage providers separately. Confirm contract terms, geographic coverage, supported account types, fees, sandbox capability, and production approval process.
3. Obtain qualified legal/compliance advice for the selected product and launch geography before designing a production funds flow.
4. Define customer consent, disclosures, eligibility, identity verification, fraud/AML responsibilities, limits, refunds, disputes, error recovery, support escalation, and account closure.
5. Build all secret-bearing provider calls and webhook processing on a secured backend. The mobile app must not contain secret keys or be trusted as the financial ledger.
6. Use idempotent transaction processing, audit trails, encryption, access controls, reconciliation, monitoring, and incident response.
7. Test in provider sandboxes, then with explicitly authorized internal/test accounts and small controlled transfers after all prerequisites are satisfied.
8. Prepare customer support and operational procedures before any production pilot.

### Deliverables

- Written product-flow decision and alternatives considered.
- Provider shortlist and partner requirements.
- Counsel-reviewed compliance and responsibility map for the chosen structure.
- Backend security, data-retention, reconciliation, and incident-response plans.
- Sandbox test plan and production go/no-go checklist.

### Acceptance criteria

- The data provider's access scope and customer authorization are clearly represented in the app.
- A transaction feed is not treated as permission to debit an account.
- Each transfer or investment action has an explicit, auditable authorization basis and understandable amount/destination/timing.
- Duplicates, pending transactions, refunds, reversals, failed transfers, and provider outages are covered by tests and operational procedures.
- Provider, legal/compliance, security, customer-support, and operations approvals are documented before production funds are involved.

### Non-negotiable release gate

No real customer funds, live withdrawals, custody, or trades in a prototype. Sandbox success alone is not approval to launch. A production pilot requires documented partner approval, counsel-led review, customer disclosures/consent, verified operational controls, and a rollback/incident plan.

---

## Cross-cutting work

### Privacy and security

- Inventory the data collected (location, transaction metadata, account identifiers, and app preferences).
- Collect only data required for the chosen feature and define retention/deletion behavior.
- Keep secrets server-side; use secure transport, appropriate storage, and restricted staff access.
- Keep personal finance records on-device by default; do not send selected CSV contents or financial records to a shared backend.
- Explain permissions and provide revocation/disconnection paths only if a future, explicitly approved integration is added.

### Quality and release process

- Keep unit/logic tests for contribution calculations, caps, rounding increments, refunds, and balance transitions.
- Run phone smoke tests for each meaningful build.
- Maintain clear demo versus production configurations.
- Monitor crashes, API availability, data quality, and user-reported issues without logging sensitive financial data unnecessarily.

### Product measures

Establish baselines before setting numeric targets. Candidate measures include:

- Station search success and price freshness/coverage in the launch area.
- Time to complete common gas-finding tasks.
- App stability and critical device-specific defect rate.
- Savings-ledger reconciliation success and understanding of displayed amounts.
- Opt-in, continued use, pause/disable rates, and user-reported usefulness of spending guardrails.
- For a future financial pilot: transaction match/reversal accuracy, transfer success/failure handling, support contacts, and consent comprehension.

Do not optimize for the amount of money collected or invested without also measuring user understanding, control, errors, and complaints.

## Suggested next actions

1. Reconcile roadmap, migration map, and phone checklist against the current grouped app and sample-first launch behavior.
2. Implement and test CSV preview/confirmation, then improve recurring-candidate review without changing local-only processing.
3. Define local persistence, migration, export, deletion, and recovery behavior feature by feature.
4. Confirm physical test devices, install development builds, and complete the updated smoke checklist.
5. Evaluate live gas-data providers only against documented coverage, freshness, terms, cost, attribution, and operational gates; preserve sample fixtures in the meantime.
6. Keep bank linking, FinanceKit, money movement, and investing integrations deferred unless explicitly authorized as a separate scope.

## Open decisions

- Which mobile platform and phone models are the first supported test targets?
- Which city or region should be used for online gas-data evaluation?
- Which iOS and Android physical devices are the initial test targets?
- Which region should be used to evaluate live gas data?
- What export, retention, and deletion behavior is expected for locally stored personal data?
- Should a later product decision expand beyond local CSV import into any account connection? Until explicitly decided, it remains out of scope.
