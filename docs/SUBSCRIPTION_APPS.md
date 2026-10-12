# Selecting subscription apps

Add/Edit subscription → Choose app shows only supported apps whose custom launch link the phone reports it can open. The list is alphabetical, searchable and refreshes when returning to the foreground. None is valid; Apple subscriptions is a separate iPhone option for subscriptions billed by Apple. URL input has been removed. Existing app associations remain saved until replaced or removed.

## Platform limits

iOS has no public API for enumerating every installed app. `canOpenURL` tests explicitly declared custom schemes (maximum 50). HTTPS URLs are excluded from detection because a browser can open them even without the provider app. Android declares specific VIEW queries for the same catalog, without `QUERY_ALL_PACKAGES`. Browser previews explain that detection requires the phone instead of listing pretend installations.

`appCatalog.json` contains the supported launch URLs and provider website fallbacks, shared by the picker and `withSubscriptionApps` plugin. The initial catalog queries Spotify, YouTube, Netflix, Disney+, Hulu, Prime Video, Twitch, Telegram, Slack, Todoist, Dropbox, Notion, Zoom and Evernote. A provider may change/remove a scheme or lack support on one platform; only a positive native check exposes its option. Provider URLs must still be verified on installed apps during phone testing, and apps outside this catalog cannot be selected yet.

The local `SubscriptionApps` Expo module reads the native binary's query configuration. Missing module/configuration shows an update message, rather than reporting that the user has no installed apps. **Rebuild GasFinder** after changing this module, the catalog or native queries. Metro reload, OTA updates and Expo Go cannot add the configuration. It works with the free Personal Team; no special entitlement or account access is needed.

## Cancellation

Planning to cancel saves the intention first and opens the chosen app. Most providers open their home screen; the user completes cancellation through that app/provider. If it was uninstalled or fails to open, the configured provider website is attempted. Only **I canceled it** marks a subscription inactive. Detection stays on-device and is not sent to a server.

## Verification

Logic checks cover positive/negative native detection, alphabetical results, partial query failures, missing native configuration, web gating and app/website launch fallbacks. CNG verifies query declarations and module discovery on both platforms. The iOS module compiles unsigned for a simulator. Phone checks must verify the installed/uninstalled catalog, app launch destinations and foreground refresh. Android Kotlin compilation needs an Android SDK, which is not installed in this workspace.

Primary references: [Apple query schemes](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html), [Expo SDK 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/), [native query configuration](https://docs.expo.dev/linking/into-other-apps/), [Spotify detection](https://developer.spotify.com/documentation/ios/tutorials/content-linking), [Twitch links](https://dev.twitch.tv/docs/mobile-deeplinks/), [Slack links](https://docs.slack.dev/interactivity/deep-linking/), [Telegram links](https://core.telegram.org/api/links), [Zoom launch](https://developers.zoom.us/docs/meeting-sdk/ios/resource/launch-zoom-client-from-your-app/).
