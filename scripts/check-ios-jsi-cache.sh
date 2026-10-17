#!/bin/bash
# ExpoModulesJSI's upstream hash omits the SDK/Xcode build. Invalidate only its
# selected generated slice when either changes, before Expo checks its own hash.
set -euo pipefail

package_dir="${1:?ExpoModulesJSI package directory is required}"
platform="${2:?Xcode platform is required}"
case "$platform" in
  iphoneos) slice=ios-arm64 ;;
  iphonesimulator) slice=ios-arm64_x86_64-simulator ;;
  *) exit 0 ;;
esac

# Fail before recording a fingerprint if Xcode cannot resolve the chosen SDK.
# SDKROOT comes from the outer build, including an explicitly selected SDK.
sdk_path="${SDKROOT:-$(xcrun --sdk "$platform" --show-sdk-path)}"
xcode_version="$(xcodebuild -version)"
swift_version="$(xcrun swiftc --version)"
sdk_build="$(xcrun --sdk "$platform" --show-sdk-build-version)"
fingerprint="$(printf '%s\n' "$xcode_version" "$swift_version" "$sdk_path" "$sdk_build" | shasum -a 256 | cut -d' ' -f1)"
products="$package_dir/Products"
marker="$products/.gasfinder-$slice-sdk"
stamp="$products/ExpoModulesJSI.xcframework/$slice/.build-hash"
if [[ ! -f "$marker" || "$(cat "$marker")" != "$fingerprint" ]]; then
  rm -f "$stamp"
  mkdir -p "$products"
  printf '%s\n' "$fingerprint" > "$marker"
  printf '%s\n' "[GasFinder] Xcode/SDK changed; rebuilding ExpoModulesJSI $slice."
fi
