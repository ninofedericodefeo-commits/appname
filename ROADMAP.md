# GasFinder Product Roadmap

## Purpose

This roadmap turns four product goals into a staged plan:

1. Learn from other gas-finding apps and improve GasFinder.
2. Test GasFinder on a physical phone and bring gas data online.
3. Explore useful money-management features, including support for reducing impulse online purchases.
4. Give users a clear, trustworthy view of money saved and contributions made.

The roadmap prioritizes learning and safe testing before connecting accounts or handling real money. It is a product direction, not a promise that every idea is technically available on every platform.

## Where the app is today

GasFinder is an Expo/React Native mobile app with separate gas and savings-goal screens. The gas finder currently uses bundled sample stations. Savings goals use manually logged purchases and the on-device savings pocket; the previous simulated investing ledger remains in a read-only archive. The local prototype also includes an optional online-purchase cooling-off planner. It does not connect to a bank, Venmo, card, or brokerage; detect real transactions; transfer funds; or execute trades.

That is a useful foundation for testing the experience, but simulated values must remain clearly identified as demo data until backed by a real, reviewed financial integration.

### Implemented locally so far

- A savings tracker summarizes simulated contributions, current demo balances, and withdrawals, with itemized contribution and withdrawal history.
- An optional, on-device purchase-pause planner lets users set a 24-hour, 2-day, or 7-day delay and self-report whether they bought or skipped a planned online purchase.
- The purchase-pause feature does not monitor accounts, intercept checkout, or block transactions. Its skipped-purchase total is an unverified user-reported estimate, not confirmed savings.
- Both features are persisted locally for the prototype. This does not make the balances real or suitable for financial decisions.
- The gas screen now separates a labeled Philadelphia sample from an opt-in online backend contract. Online search requires location permission, validates server data, and shows errors without silently substituting samples. A provider and backend are still required before live fuel prices are available.
- Local ledger entries can be filtered by date and removed with balance-safe corrections; purchase-pause records can be deleted. Physical-phone verification is tracked in `docs/PHONE_SMOKE_TEST.md`.
- A mobile receipt-report flow now stores a photo and user-confirmed fuel price, fuel type, date, and station address or on-site GPS on the device. It does not extract receipt text or publish prices to other users. Shared prices require an authenticated backend, duplicate checks, moderation, retention rules, and a plan for handling false reports.
- A separate savings pocket now earmarks part of a manually entered account balance on this device. It is an estimate within the user's existing account; it cannot verify, transfer, or restrict bank funds. This matches the requested no-bank-connection scope.
- One active savings goal can use all or none of an existing pocket amount, accept confirmed set-asides, and show suggestions based on manually logged purchases and an optional deadline. An optional iPhone widget shows goal progress, with amounts hidden by default. Neither goals nor the widget represent a verified balance or an investment.
- A local subscription tracker now records monthly or yearly renewal dates and user-entered prices. It prompts for each renewal on the preceding calendar day and can schedule optional local 9 AM notifications. A plan-to-cancel decision is a reminder to act with the provider, not a cancellation or blocked charge.

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
| 1 | Competitor research and product discovery | Evidence-backed list of gas-finder problems and opportunities |
| 2 | Phone testing and experience quality | A repeatable real-device test process and a stable mobile demo |
| 3 | Online gas information | Reliable, licensed station and price data for a defined launch area |
| 4 | Savings tracker | A reconciliable record of contributions, balances, and withdrawals |
| 5 | Online-purchase guardrails | Optional tools that help users pause or budget discretionary spending |
| 6 | Real financial connections | A carefully selected, consent-based route to transaction data and, separately, money movement or investing |

Workstreams 1 and 2 can begin with the current demo. Online gas data, the savings tracker, and purchase guardrails can be explored independently. Real financial integrations depend on selecting providers and completing the required product, legal, security, and operational reviews.

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

1. Confirm the target platforms and devices (initially Android, iOS, or both) and define the minimum supported OS versions.
2. Create and install the appropriate Expo development build on the target phone. Use a development build when Expo Go does not include a required native module.
3. Test the current local-data experience:
   - First launch, reload, and app restart.
   - Location permission granted, denied, unavailable, and later changed in Settings.
   - Gas-to-investing navigation and return navigation.
   - Small and large screens, text scaling, keyboard appearance, and touch target sizes.
   - Investment settings, persisted demo state, and transaction consent flow.
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
- Core gas and investing navigation works after reload and restart.
- Permission denial does not strand the user or misrepresent the default test location.
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

## 4. Build a savings and contribution tracker

### Goal

Help users understand what they have contributed, what remains available, and what they have withdrawn—without claiming that simulated contributions or market changes are guaranteed savings.

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

1. Start with an itemized, local/demo ledger and label every demo value.
2. Show contribution date, purchase or trigger reference, selected rule, calculated amount, destination, and status.
3. Add clear totals for contributions, withdrawals, and current balance; keep them separate.
4. Plan for duplicate transaction events, pending-to-posted changes, refunds, reversals, corrections, and provider reconciliation.
5. Provide a transaction detail view, date filtering, export, and a way to correct or remove user-entered demo data.
6. When a provider is selected, specify which figures come from the provider and how recently they were refreshed.

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

## 5. Explore ways to limit unnecessary online purchases

### Goal

Offer optional, user-directed tools that help people think before discretionary purchases without secretly monitoring them or implying the app can block payments it does not control.

### Start with discovery

- Ask users what they mean by “unnecessary” and which purchase situations they want help with.
- Learn whether their preferred intervention is a reminder, a budget, a delay, or a spending summary.
- Identify accessibility needs, false-positive concerns, privacy expectations, and ways the feature could feel judgmental or coercive.

### Candidate first features

- **Cooling-off reminder:** user chooses a delay before acting on a planned nonessential purchase.
- **Intent prompt:** user records what they intend to buy and why, then reviews that note after the chosen delay.
- **Discretionary budget:** user sets a voluntary period/category limit and receives a progress indicator or warning.
- **Purchase reflection:** a configurable prompt or reminder before a user goes shopping, without intercepting an external payment.
- **Spending summary:** opt-in totals and trends based on data the user has explicitly provided or authorized.

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

## 6. Explore real account, payment, cash, and investment integrations

### Goal

Determine which real-money product is feasible, then implement only a user-authorized flow supported by qualified providers and reviewed operational controls.

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
- Explain account permissions and provide revocation and account-disconnection paths.

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

1. Start the competitor opportunity log and choose the first gas apps/tasks to review.
2. Confirm phone platforms/devices and complete a local-demo install and smoke test.
3. Pick an initial online-data geography, then compare station and fuel-price sources and their terms.
4. Define the savings metrics and ledger statuses before expanding the finance dashboard.
5. Interview users about impulse-purchase situations and test a reversible reminder/budget concept.
6. Only after product direction is clear, shortlist financial partners and begin counsel-led feasibility review; keep all financial testing in sandboxes until production gates are met.

## Open decisions

- Which mobile platform and phone models are the first supported test targets?
- Which city or region should be used for online gas-data evaluation?
- Is the first financial goal transaction visibility, a user-approved transfer, cash savings, or brokerage investment?
- Should online-spending support focus on budgets, cooling-off reminders, or another user-validated behavior?
- Which privacy, retention, and account-deletion expectations should be product defaults?
