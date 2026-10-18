# Associating a bill with an installed app

In Bills, add or edit a subscription, then choose **Choose app**. Discovery runs on demand and refreshes when returning to the app. It stays on the device; the app list is not uploaded. Selecting an app does not discover prices, charges, subscriptions or cancellation status. Confirm these from receipts or imported bank history.

On iPhone, the picker checks installed handlers for the supported URL schemes in `appCatalog.json`. Apple requires each queried scheme in `LSApplicationQueriesSchemes` and limits this list to 50. iOS does not provide a public general-purpose installed-app inventory. Apple subscriptions is also available as a billing-management destination. Do not describe the supported list as every app on the iPhone.

On Android, the native `SubscriptionApps` module queries `ACTION_MAIN` + `CATEGORY_LAUNCHER`, so apps do not need to be in the provider catalog. The config plugin declares this narrow intent query rather than requesting `QUERY_ALL_PACKAGES`. Hidden apps, apps without launcher activities and apps in other profiles may not be returned. Labels and package identities are validated before selection. Opening a selected app uses `PackageManager.getLaunchIntentForPackage` with a validated package name; it does not interpret supplied intent URLs.

**Add another app or website** allows manual association on every platform. Enter the provider's name and HTTPS account website or a known app link. This does not claim the app is installed. App association is optional and never creates a bill automatically.

The Android inventory requires a new native build containing the updated local module and manifest query. An older Android build reports that an update is required rather than displaying an empty inventory. The existing iOS supported-app capability also requires a build containing its query configuration; JavaScript updates cannot change Info.plist. A web browser cannot inspect the phone's installed apps; manual website association still works there.

References checked October 18, 2026:

- [Apple canOpenURL](https://developer.apple.com/documentation/uikit/uiapplication/canopenurl(_:))
- [Android package visibility declarations](https://developer.android.com/training/package-visibility/declaring)
- [Expo 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)
- [Expo native module API](https://docs.expo.dev/modules/module-api/)
