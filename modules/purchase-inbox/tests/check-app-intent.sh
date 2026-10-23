#!/bin/sh
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
TEST_ROOT=$(mktemp -d /private/tmp/tally-app-intent.XXXXXX)
trap 'rm -rf "$TEST_ROOT"' EXIT
SDK_PATH=$(xcrun --sdk iphonesimulator --show-sdk-path)

# Compile the real queue and action together with Expo's import access level.
# Compiling the action alone misses conflicts with ExpoModulesProvider.swift.
xcrun swiftc -sdk "$SDK_PATH" -target arm64-apple-ios16.4-simulator \
  -swift-version 5 -module-cache-path "$TEST_ROOT/cache" -emit-module \
  -module-name PurchaseInbox -emit-module-path "$TEST_ROOT/PurchaseInbox.swiftmodule" \
  "$PROJECT_ROOT/modules/purchase-inbox/ios/PurchaseInboxQueue.swift"
cat > "$TEST_ROOT/AutolinkingImports.swift" <<'SWIFT'
internal import PurchaseInbox
func checkAutolinkedQueue() { _ = PurchaseInboxQueue.self }
SWIFT
xcrun swiftc -sdk "$SDK_PATH" -target arm64-apple-ios16.4-simulator \
  -swift-version 5 -module-cache-path "$TEST_ROOT/cache" -I "$TEST_ROOT" \
  -emit-module -module-name TallyIntentSmoke -emit-module-path "$TEST_ROOT/TallyIntentSmoke.swiftmodule" \
  "$PROJECT_ROOT/modules/purchase-inbox/app-target/QueueWalletPurchaseIntent.swift" \
  "$TEST_ROOT/AutolinkingImports.swift"
echo 'AppIntent compiles with the Expo autolinking import access level.'
