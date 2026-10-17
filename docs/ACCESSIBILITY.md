# Accessibility

Updated October 16, 2026. These are implemented aids and acceptance checks, not a certification.

## User controls

Open **Settings → Accessibility** from any main page. Changes save immediately and are included in encrypted portable backups.

| Option | Behavior |
| --- | --- |
| Bolder text | Raises regular text in shared styles to semibold while preserving existing heavier weights. Native iOS Bold Text also enables this, including after a foreground refresh. |
| Larger controls | Raises shared 44–55 point minimum control dimensions to 56 points. Fixed square icon controls grow together; smaller decorative avatars stay the same size. Date tiles use 56 × 56 bounds and wrap chronologically on narrow screens. |
| Stronger contrast | Uses the existing contrast preference and semantic light/dark tokens. The General & appearance control changes this same setting. |
| Always reduce motion | Disables page/sheet transitions through the existing reduced-motion hook. Off follows the system preference; it never forces animations over the system setting. |
| Prefer station list | Starts Gas in its text/list view. Native VoiceOver/TalkBack detection also selects List first. The user can explicitly choose Map during that session; the free map remains available. Browser screen-reader detection is unavailable, so use the preference there. |

Text size continues to use native system scaling and browser zoom. Screen-reader/Bold Text detection is session state, not stored or backed up. Settings schema **5** adds defaults to older saved settings without changing financial records.

## Interaction improvements

- Subscription name/price and manual movement name/amount have persistent labels, field-specific errors and invalid states. Web descriptions are associated by ID; native field hints include the error. Invalid submission focuses the first invalid field after the errors render, with an explicit native accessibility-focus event. Editing a field clears its own error without jumping to another field.
- Savings adjustments associate input/availability errors with the amount field. Existing save guards remain in effect.
- Subscription and savings sheets focus their heading on opening. Existing confirmation/draft guards keep their focus and recovery behavior.
- Transactions include visible Money in/Money out/refund text alongside signs/colors. Their spoken summaries include direction, name, amount, date, status and source; details expose an additional named accessibility action. Decorative avatars/chevrons/account icons are excluded from reading.
- Station names are headings. Repeated directions, refill/report and history actions identify the station/address/fuel; prices have a per-gallon spoken label or an explicit missing-price label. Station report/history/map controls have larger minimum bounds.
- The web main tab bar uses one Tab stop; Left/Right wrap, Home/End choose the first/last tab. Selected state and the complete Subscriptions label are exposed.
- Web calendars use one day Tab stop. Arrow keys move by day/week, Home/End to week boundaries, Page Up/Down by month with month-end clamping. Enter selects; Escape closes. Selection/closing returns focus to the date control. Dates stay inside the allowed interval. Native date controls additionally offer named Previous day/Next day actions.

## Evidence from this batch

- 295 logic tests pass, including calendar boundary/leap-year/month-clamping, tab navigation, style sizing/immutability and restored-preference validation cases.
- Lint and TypeScript pass; iOS/Android/web JavaScript exports pass. No dependencies or native build configuration changed.
- Isolated browser origin: settings persist after reload; 320 px has no horizontal overflow; enlarged fields/date tiles measure 56 points/pixels in the browser; bolder body text becomes weight 600.
- Browser keyboard checks: invalid subscription submission focuses Subscription name; a valid movement name with missing amount focuses Movement amount; tab Home/End navigate and retain focus; calendar arrows/Enter change the date and return focus; Escape closes only the calendar and preserves the sheet. Prefer station list starts List while explicit Map remains possible. No financial record was saved during these checks.
- Screenshot: `/tmp/gasfinder-accessibility-proof/settings.png`. Temporary preference changes and unsaved test drafts were cleared afterward; the main preview origin was left untouched.

## Phone acceptance still required

1. Turn VoiceOver/TalkBack on before launch and while Gas is open. Confirm List first, station/action names, transaction summaries/custom actions, and ability to choose Map.
2. Open each changed form. Submit invalid fields, correct them, dismiss/return and verify spoken error/focus behavior and keyboard access to Save/Cancel.
3. Try the largest native accessibility text sizes in both themes, with Larger controls and Stronger contrast. Check complete amounts, wrapping, calendars and all four tabs.
4. Change iOS Bold Text/system Reduce Motion while installed. Verify foreground updates; test the explicit motion override and navigation/sheets.
5. With amount privacy enabled, confirm the financial content stays absent from the accessibility tree until revealed; then verify focus returns predictably.

The earlier simulator Debug/Release builds in FINISH_STATUS predate this batch. JavaScript export and browser evidence do not replace physical assistive-technology testing.
