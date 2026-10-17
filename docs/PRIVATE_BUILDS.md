# Private builds, without store publication

`eas.json` includes development, personal-preview, personal-stable, enrolled-preview and simulator-preview profiles. Preview/stable are internal Release builds with bundled JS/assets. They do not require Metro at runtime. The development profile uses the development client. Keep the existing bundle identifiers to preserve app data across compatible updates.

- Enrolled iOS cloud build: `npx eas-cli@latest build --platform ios --profile personal-preview`. EAS internal ad-hoc distribution needs Apple Developer membership and registered devices. `enrolled-preview` additionally enables the existing widget/App Group/direct share configuration. Do not use that profile with a free Personal Team.
- Free Personal Team: preserve the existing local Xcode signing workflow. Generate with `npx expo prebuild --platform ios --no-install`, select your Personal Team in Xcode and build Run with Release configuration (or use `npx expo run:ios --configuration Release` with the intended device). Native directories are generated and remain ignored. Provisioning expires; reinstall/refresh using the same identity. Make an encrypted backup before changing signing or reinstalling.
- Android: `npx eas-cli@latest build --platform android --profile personal-preview` creates an APK. Preserve signing keys for compatible upgrades.
- Simulator: `npx eas-cli@latest build --platform ios --profile simulator-preview`; this checks a simulator binary, not device signing or phone integrations.

No build was uploaded, paid membership purchased or signing identity changed as part of local implementation. EAS project linking and credentials are completed by the owner when building. No OTA service is enabled; future OTA requires runtime-compatible channels, migration recovery and a deliberate service setup.

## Acceptance before everyday use

Create an encrypted backup including originals/photos; install an update under the same app identity; turn the computer off; cold launch in airplane mode; inspect Account/Goals/Subs and cached gas; restore a copy on another installation and inspect attachments. Check privacy relock, notification permission/delivery, file handoff and extension status. Native OCR must be built and checked with real receipts before calling recognition verified. Check Settings → This build for configured capability limits.

Official references checked for SDK 57: https://docs.expo.dev/eas/json/ and https://docs.expo.dev/build/internal-distribution/ .

## Xcode SDK changes and error 65

Error 65 is a summary; inspect `.expo/xcodebuild.log` and `.expo/xcodebuild-error.log` for the first compiler error.

On October 16, the connected-device Debug build failed in `ReceiptOcr` while importing `ExpoModulesCore`/`ExpoModulesJSI`, with `cannot find type '__ObjC::expo' in scope` and a follow-on SDK/compiler mismatch message. The device JSI slice was cached from September 28. Expo's existing cache hash includes the Swift compiler version but omits the SDK/Xcode build, so it can reuse a binary module after an SDK change and fail when falling back to its textual C++ interface. This matches the [upstream cache report](https://github.com/expo/expo/issues/50365).

`withIosJsiSdkCache` now installs a CocoaPods post-install hook through Expo prebuild. It prefixes only the existing ExpoModulesJSI framework build phase with `scripts/check-ios-jsi-cache.sh`. The script records the Xcode build, Swift version and selected platform SDK path/build; a changed fingerprint removes only that slice's generated `.build-hash`, letting Expo rebuild it normally. The device and simulator are tracked separately. The hook is idempotent and runs for CLI and Xcode builds. It does not change signing, capabilities, module source or app identifiers.

After pulling this configuration on an existing checkout, regenerate and install pods once:

```sh
npx expo prebuild --platform ios --no-clean --no-install
cd ios
pod install
cd ..
npx expo run:ios --device
```

The first build for each platform regenerates its JSI framework; later unchanged builds retain Expo's cached fast path. Native folders and dependency build products stay generated and ignored.

Verification for this fix: existing Personal Team signing succeeded for the connected physical iPhone Debug build (`/tmp/gasfinder-ios-device-sdkfix.log`). Expo's device command also succeeded with zero errors and installed GasFinder (`/tmp/gasfinder-ios-sdk-expo-run.log`), reusing the existing Metro server on port 8087. Lint, TypeScript and 299 tests pass, including four SDK-cache regression tests. Installation/build success does not establish phone accessibility, OCR accuracy or standalone Release acceptance.
