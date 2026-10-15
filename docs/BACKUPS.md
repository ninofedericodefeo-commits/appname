# Backup, restore and recovery

Settings → Data → Backup & restore exports a `.gasbackup` file through the system share sheet (or an explicit browser download). Keep the file in Files/iCloud Drive and its password separately. Passwords are never saved; forgotten passwords cannot be recovered.

## Format and limits

Version 1 uses PBKDF2-SHA256 (600,000 iterations, fresh 16-byte salt) and AES-256-GCM (fresh 12-byte nonce, authenticated format header). Random bytes come from Expo Crypto. Cryptographic primitives are supplied by the noble libraries. Each attachment has a SHA-256 checksum. Maximum decoded attachments: 30 MB; plaintext: 48 MB; encrypted file: 68 MB. No unencrypted portable backup is generated.

Records include store versions, stable IDs, duplicate keys, purchase/bank links, visibility and direction choices, annotations/correction history, balance snapshots, savings, goals, subscriptions, cars, local prices, import metadata and preferences. Optional attachments include originals (including Trash) and retained receipt photos. Records-only restore marks originals missing and clears unusable photo paths. Relink the same original in Saved imports without importing money again.

Device lock/privacy preferences are deliberately excluded. Phone notification permission and native capabilities are rechecked locally. Widget amounts remain controlled separately. The in-app lock uses OS authentication and does not encrypt AsyncStorage.

## Recovery

Restore validates the envelope, authenticated plaintext, checksums, IDs, schema and supported store migrations before replacing data. A durable journal precedes mutation. Originals/photos are staged under separate physical names; logical source IDs remain stable. Store writes are serialized, reads are verified, and interactions/widget/reminder updates are blocked while applying records. Interrupted restore/import is rolled back before the main screens mount. A successful restore keeps one local Undo restore copy. Undo replaces changes made since that restore; create another encrypted backup first if you want to keep them.

Bank imports use a separate recoverable journal for file metadata, ledger, chosen contributions and balance choice. A retry retains duplicate keys; repeated equal real purchases remain distinct. Original-file Trash/rename/relink do not remove financial records. ZIP export is an unencrypted copy of selected originals and metadata.

The local recovery journal contains the same private records as local app storage. It is not a portable encrypted backup and does not survive app uninstall or device loss. Close other browser tabs before restore/import; web stores are scoped to this browser origin/profile. Export before clearing browser data or changing signing identity.

## Verification and remaining device gate

Covered by automated tests: Node crypto interoperability, wrong passwords, modified ciphertext, version/work-factor rejection, checksums, encoding bounds, invalid financial records, duplicate IDs, journal ordering and rollback fault injection. Browser acceptance uses synthetic bank fixtures only: encrypted export/inspect/restore, reload, Undo, renamed-file reimport with zero duplicates, Trash/restore, source links and correction/undo.

A rebuilt iPhone/Android app is needed for the newly added Crypto, LocalAuthentication and ScreenCapture native modules. Physical-device Face ID/passcode fallback, relock timing, switcher snapshots, attachment restore across separate installations, OS file sharing and delivery of restored reminders still require device acceptance. No signing or native acceptance is implied by a successful JS export.
