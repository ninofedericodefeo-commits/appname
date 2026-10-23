# Purchase review inbox (iOS)

`Queue purchase for review` is an AppIntent compiled in the main application target by `plugins/withPurchaseInbox.js`. It uses the `PurchaseInbox` local Expo module's public queue implementation, without opening the app or depending on JavaScript. Requires a new native build; Expo Go and an OTA update cannot install the action. No App Groups or enrolled-team capability is required.

Inputs: Merchant (nonempty, at most 80 UTF-16 code units), Amount (positive USD amount, at most two decimal places and $1,000,000), Currency (USD default; other currencies rejected), optional Transaction ID (stable identifier for idempotent delivery; never stored raw). With no transaction ID, each invocation is a separate review draft.

The action only writes draft records in Application Support/PurchaseInbox. It never writes balances, purchases, reserves, or savings. A draft is `{ id, merchant, amountCents, currency: 'USD', capturedAt }`. IDs are lowercase UUID strings, with SHA-256-derived RFC 9562 version 8 IDs for caller-provided transaction IDs. Reusing an ID with different purchase details throws an error.

Queue files are atomic, private, excluded from backup, and protected with `NSFileProtectionCompleteUntilFirstUserAuthentication`. After a restart, the phone must be unlocked once before this storage becomes available. Capturing can then work while the phone is locked. Up to 200 drafts are retained for 30 days; a full queue rejects new records without evicting unreviewed purchases. Operations use a file lock to serialize concurrent capture, review acknowledgement, and erasure. File operations throw on failures.

JS bridge `requireOptionalNativeModule('PurchaseInbox')`:

- `getVersion(): 1`
- `listPending(): Promise<Draft[]>`
- `removePending(id): Promise<boolean>` — true if removed; false if already absent; throws on invalid ID or filesystem errors.
- `clearPending(): Promise<void>` — used during app data erasure; throws on errors.

The JS caller must wait for foreground, hydrated, unlocked privacy state before reading the queue. Review requires explicit user confirmation. Removal acknowledges only the native draft and does not itself save a financial record.

Run `sh modules/purchase-inbox/tests/run-native-tests.sh` on macOS with Xcode to test the real Swift queue with an isolated test directory. The compile-only `PURCHASE_INBOX_TESTS` flag swaps the base directory for this harness; production builds use the app's Application Support directory.

Run `sh modules/purchase-inbox/tests/check-app-intent.sh` to compile the action alongside Expo's generated-provider import access level. This catches Swift import conflicts that compiling the action in isolation does not expose. The config-plugin tests also verify the serialized Xcode source path and repair of older generated groups.

During implementation the queue and AppIntent compiled against the iOS simulator SDK targeting iOS 16.4, and Apple's AppIntents metadata processor successfully extracted the action, its inputs, `openAppWhenRun: false`, and explicit always-allowed authentication policy. This is not a substitute for a signed device build and a locked-phone Wallet automation test.

The setup guide and unavailable-inbox state were inspected on web at 320 and 1024 pixels in light and dark themes. The review boundary has regression coverage for explicit Save, failed persistence, failed acknowledgement, duplicate retries, foreground/privacy revocation, and erasure errors. Populated native inbox rendering and a real Wallet trigger still require iPhone acceptance; the web preview cannot exercise the native action.
