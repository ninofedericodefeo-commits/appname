# GasFinder interface redesign

October 17, 2026. Implemented in the existing Expo SDK 57 application.

## Direction and scope

Gas Finder now puts location, fuel grade and station results ahead of secondary tasks. The main screen uses a large title, one area-search control with a separate current-location action, a fuel selector, a Filters disclosure, and a Map/List selector. At wide widths, drive planning, cars and reports sit beside results; on phones, they follow results.

Station cards emphasize the station, price, distance and Directions. Details reveals reporting and saved history. A green cue identifies the lowest recent report; stale, missing and sample prices cannot receive it. Price units, payment qualifiers, report age, attribution and the unverified-price explanation remain visible. Map chrome, markers and legends follow the selected theme; the OpenStreetMap base tiles retain their provider colors.

The shared palette uses neutral grouped backgrounds, blue actions and green savings indicators. Icon tabs, Account, Goals, Subscriptions and grouped Settings follow the same rules. Text uses the system font. Station cards stack at narrow widths or large text sizes, and the main heading gets more room at large sizes. Tab labels and the decorative brand scale up to 1.5× so navigation stays usable while content keeps the full system text scale. Larger controls and stronger contrast still use the existing accessibility preferences. System appearance now uses `automatic` in native configuration.

Design references: Apple [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [color](https://developer.apple.com/design/human-interface-guidelines/color) and [tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars). Expo [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/) and [safe areas](https://docs.expo.dev/develop/user-interface/safe-areas.md) were checked before implementation. Designly composition/typography/visual-QA and No AI Slop editing guidance informed the implementation.

## Verification

- `npx expo lint` and `npx tsc --noEmit` pass.
- All **299 existing logic tests** pass. The focused station, area-search, price-freshness, fuel-reporting and Maps-link suites also passed independently (23 tests).
- Independent code review found no remaining actionable correctness issues after restoring map-area search without GPS and matching the native map viewport to its content height.
- Browser checks used a separate `127.0.0.1:8087` origin. Synthetic Boston station names/prices were loaded only into that isolated browser origin; external station responses were intercepted for repeatable visual checks. They are not production data or a new app demo mode. No account balances, bank files, purchases or real subscriptions were changed.
- Inspected Gas in light/dark at 390px, narrow layouts at 320px, and wide layouts at 1024px. Also inspected the other tabs and Settings in narrow/light and wide/dark states, station Details, expanded Filters, saved history, and larger/bolder/stronger-contrast controls at 320px.
- Exercised favorites on/off, recent-only filtering against fresh/stale/unpriced stations, filter reset, Map/List switching, history navigation, Settings search/no-results, and map-area selection with neither GPS nor a saved area. Checked a 56px favorite target with Larger controls enabled.
- A refreshed **iPhone 18 Pro / iOS 27 simulator development build** succeeded with zero errors. Native home, safe areas, tab bar, no-location map, and automatic light/dark appearance were inspected. The installed older binary first lacked ExpoSharing, so native projects and pods were regenerated through Expo and the simulator binary was rebuilt. Generated native files remain untracked.
- A clean launch at the maximum accessibility text size succeeded with a fresh Metro session. Changing that size while Fast Refresh was attached produced clipped glyphs and one native React renderer/scheduler SIGSEGV (`Scheduler::uiManagerDidDispatchCommand`). No new crash occurred on the clean maximum-size launch. This development-refresh issue is recorded rather than treated as a passed live-resizing test.

Physical iPhone/Android, native VoiceOver journeys, GPS accuracy, native station-card interactions and a Release build remain outside this verification. See the existing [accessibility guidance](ACCESSIBILITY.md) and [phone smoke checks](PHONE_SMOKE_TEST.md). This is not a full accessibility certification.

## Captured examples

These are actual rendered screens. The station figures are synthetic verification fixtures.

- [Station list, light](redesign-2026-10-17/list-light.png)
- [Station list, dark](redesign-2026-10-17/list-dark.png)
- [Station details, light](redesign-2026-10-17/details-light.png)
- [Wide map and driving tools, light](redesign-2026-10-17/map-light-wide.png)
- [Wide map and driving tools, dark](redesign-2026-10-17/map-dark-wide.png)
- [Narrow grouped Settings](redesign-2026-10-17/settings-light-320.png)
- [Account, dark](redesign-2026-10-17/account-dark-wide.png)
- [Subscriptions, narrow](redesign-2026-10-17/subscriptions-light-320.png)

- [Native home, light](redesign-2026-10-17/native-light.png)
- [Native home, dark](redesign-2026-10-17/native-dark.png)
