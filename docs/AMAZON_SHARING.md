# Share Amazon items to GasFinder

In Amazon, open the product or Amazon Autos vehicle listing, tap Share, then choose GasFinder. On iPhone, GasFinder may be under More in the app row; add it to Favorites there. GasFinder opens a draft so you can review the details before creating a savings goal. It never buys the item or changes a goal just because a link was shared.

Amazon can send a URL alone or a title followed by a URL. GasFinder accepts either and checks every URL attachment for a supported Amazon link. Standard US product links, `a.co` short links and Amazon Autos `/vindp/…` listings are supported. Autos details may require manual entry. Maps shares and bank PDF/CSV shares keep their existing destinations.

## Install a build with sharing enabled

Android sharing is enabled in the app configuration. Install a newly built Android app to see GasFinder in the system Share sheet. Expo Go and a browser preview cannot add GasFinder as an installed share target.

iPhone sharing needs an app extension and App Groups signed by an enrolled Apple Developer team. A free Personal Team build does not support this capability. The default `development`, `personal-preview` and `personal-stable` profiles deliberately leave it disabled. An existing installed binary cannot acquire a share extension through an over-the-air update.

The `sharing-preview` EAS profile enables the share extension without enabling push notifications or widgets:

```sh
npx eas-cli@latest build --platform ios --profile sharing-preview
```

Use credentials from an enrolled team and install the resulting build. The existing `enrolled-preview` profile also enables sharing together with the other enrolled-team capabilities. Local build configuration can enable only sharing with `EXPO_ENABLE_IOS_SHARING=1`; do not use that flag with a free Personal Team.

Expo SDK 57 marks incoming sharing as experimental. Its iOS implementation opens the main app from the extension, a behavior Expo says is not officially supported by Apple and could change with an iOS release. This project adds no custom responder-chain workaround. See [Expo SDK 57 Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/).

## Device acceptance checks

Logic tests cover URL selection, unsafe hosts, malformed payloads, repeat deliveries and bank/Maps routing. They do not prove that Amazon or iOS displays the share target. After installing the appropriate binary, verify on each supported phone:

1. With GasFinder closed, share a standard Amazon item and an Autos listing. Confirm the review draft opens and no goal is created automatically.
2. Repeat while GasFinder is open, then share the same item again after archiving a goal. Confirm each delivery opens the new draft.
3. Share an `a.co` link and an Amazon item whose share includes its title. Review the title and price, including the manual fallback for unavailable details.
4. Share a Maps destination and a Citizens PDF/CSV statement. Confirm they still open route planning and statement review respectively.
5. With app lock enabled, share while locked. Unlock before interacting with the draft; confirm no financial record changes without confirmation.

If an installed Personal Team build has no GasFinder share target, use the in-app link field until an enrolled-team build is installed.
