#!/bin/sh
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
TEST_ROOT=$(mktemp -d /private/tmp/gasfinder-purchase-inbox.XXXXXX)
trap 'rm -rf "$TEST_ROOT"' EXIT
xcrun swiftc -D PURCHASE_INBOX_TESTS -module-cache-path "$TEST_ROOT/cache" \
  "$PROJECT_ROOT/modules/purchase-inbox/ios/PurchaseInboxQueue.swift" \
  "$PROJECT_ROOT/modules/purchase-inbox/tests/main.swift" -o "$TEST_ROOT/queue-tests"
"$TEST_ROOT/queue-tests" "$TEST_ROOT/data"
