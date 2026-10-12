# Checkout pause and widgets

## What the first blocker does

Choose shops and a 24-hour, 2-day or 7-day wait in the browser extension. Product pages and carts remain available. Dynamic network rules interrupt recognized checkout/payment URLs, checkout/payment subdomains and Amazon/eBay checkout routes. They also cover matching iframe and AJAX requests. Rules persist across browser restarts. After the wait, checkout stays paused until the person chooses Resume shopping.

This is a voluntary checkout interruption, not a bank/card freeze. Inline payments on different URLs, external payment services, unselected shops, shopping apps and other browsers can bypass it. Browser settings can disable the extension. Changes in a shop's checkout URLs may require new rules. Do not promise universal payment prevention.

The extension only requests `declarativeNetRequest` and `storage`. It has no page/host permissions, content scripts, native messaging or bank integration. Choices and deadlines stay in each browser's local extension storage; browser/device settings do not sync with the app. App setup reports extension installation/enabled state, not whether a checkout pause is active.

## Safari on iPhone

The `withSpendingPauseExtension` CNG plugin generates and embeds the Safari extension. Source assets live in `extensions/spending-pause`; native entry code is in `native/spending-pause`. Do not edit generated `ios/` files. EAS extension metadata is added automatically, without App Groups or push entitlements for the blocker.

Install a new GasFinder iPhone binary; Metro reload and Expo Go cannot add this extension. Enable GasFinder Spending Pause in Settings → Apps → Safari → Extensions. Open its controls from Safari's page menu, choose shops and tap Pause checkout. On iOS 26.2+, the app can open the documented extension settings screen and query the enabled state. Earlier versions use the manual settings instructions.

## Desktop Chrome

Run `npm run build:chrome-extension`. Load `dist/chrome-extension` in desktop Chrome's Extensions → Manage extensions → Developer mode → Load unpacked. Pin/open Spending Pause, then select shops and start a pause. The build removes Safari-specific manifest metadata and uses a PNG icon and a classic service worker. Callback messaging supports Chrome versions before promise-returning listeners.

Chrome on iPhone does not load these browser extensions. Its mobile Add to Desktop flow installs on a computer. The Chrome build has not been published to the Web Store or installed in the user's browser.

## Account widget

The Account widget shows the saved available balance (bank balance minus set-aside) and the set-aside amount. Enable it in universal Settings, then add GasFinder account from the iPhone widget gallery. Amounts are hidden by default and omitted from widget payloads unless enabled. The medium size identifies the saved balance date; it is not a live bank feed.

The manual purchase waiting list and its Live Activity have been removed. Widget-enabled builds dismiss activities created by earlier versions at launch/foreground; the old runtime factory remains only for that compatibility cleanup. No new waiting-list activity is started. Existing logged purchases and legacy local storage are retained.

The Account/Goal widgets use the existing `expo-widgets` integration. The Personal Team build disables App Groups, so widget controls are unavailable there. An enrolled Apple developer team and a newly signed build with `EXPO_ENABLE_IOS_CAPABILITIES=1` are required. The checkout blocker and subscription app picker do not require those capabilities.

## Verification and remaining device checks

Logic tests cover safe domains, browsing versus checkout URLs, locked deadlines, concurrent taps, rule/storage failures with rollback, real worker callback messaging, sample subscription month/year boundaries, and dismissal of retired activities. Required lint and TypeScript checks pass. iOS/Android/web exports and the widget-enabled iOS export pass. Isolated CNG checks generate the Safari, widget and sharing targets; the Safari extension and native Expo setup module compile unsigned for the simulator.

Mobile browser previews check sample review/removal/reset, Settings positioning/touch area, saved-car appearance and popup start/reload/deadline/resume behavior. The popup's network API was simulated; these checks do not prove Safari/Chrome interception or ActivityKit rendering on a physical phone. Complete the phone checklist before treating those native integrations as device-verified. No actual payment is needed for that check.

References: [Expo SDK 57 widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/), [Expo app extensions](https://docs.expo.dev/build-reference/app-extensions/), [Apple Safari blocking](https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension), [Chrome network rules](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [Chrome extension installation](https://support.google.com/chrome_webstore/answer/2664769?hl=en), [ActivityKit lifecycle](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).
