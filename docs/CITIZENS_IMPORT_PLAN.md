# Citizens statement download and import

## Quick import (implemented October 10, 2026)

1. Open **Account → Quick statement import** (also available inside Import statement).
2. On iPhone, use **Add Import Statement shortcut**, then choose Shortcuts → Add Shortcut. The bundled, Apple-signed workflow accepts a shared PDF and uses **Open File in GasFinder**. Its action/input/app parameters were inspected in Apple’s current macOS Shortcuts editor. No bank credentials, network actions or PDF data in URLs are used. Android can share the PDF directly to GasFinder.
3. Keep the account nickname used for previous imports. Optionally enable **Automatically import PDFs I share** and save the preference. This is off by default.
4. Open the statement PDF in the **Citizens app → Share → GasFinder Import Statement**. The user confirmed the Citizens app offers PDF Share/Download. If the viewer offers only Download, share the downloaded PDF. Add the shortcut to Share-sheet Favorites once to keep it near the top.
5. Review the first statement once to confirm the PDF’s account identifier. Subsequent shared PDFs must match that identifier and nickname. A changed/missing identifier, reading warnings, possible app purchase matches, unreadable ledger rows, missing/invalid balance or a balance older than the saved one opens the normal review. Changing the setup nickname clears the confirmation. The identifier is kept locally and never displayed in the setup UI or transmitted.
6. Eligible shared PDFs archive their original first, then add the full readable bank history, new purchases and statement closing balance. Existing records and identical archived files remain deduplicated. Set-asides are not applied automatically. Charges supply subscription suggestions; adding subscriptions still requires review.
7. The app checks current settings/purchases/balance again after the archive write. Storage errors, canceled/expired jobs and changes requiring review cannot apply an automatic import. A receipt in setup records an actual saved statement, never just returning from Shortcuts. File-picker selections, reopened archives, pasted CSV and shared CSV remain manual.

The signed shortcut is packaged and its source/action destination verified. **Physical iPhone installation and Citizens → Shortcuts → GasFinder cold/warm launch remain unverified.** Test on the installed build that already includes PDF document registration; Expo Go cannot receive files for GasFinder. The original page 2 layout also remains unverified without the real redacted PDF.

## Manual flow

1. Open a checking/savings PDF in Citizens, or use **Import statement → Get statements from Citizens → Open Citizens website** for online banking’s Document Center.
2. Share/Open in GasFinder, or save to Files and choose the PDF from Import statement.
3. Automatic import is optional; files chosen or reopened in the app always show a review.
4. Review the per-page counts and closing balance, then confirm. The statement balance is selected by default, including when an older or repeated statement replaces a manual balance. Uncheck it to retain the saved balance.
5. The app creates its **Imports** folder automatically and keeps the original file when the import is confirmed. **Account → Saved imports** allows another review or sharing/downloading the original. Existing transactions and matching app purchases remain deduplicated.

On phones the folder is inside GasFinder’s document storage, with file export through Share. On the web, files are stored in this browser’s IndexedDB and can be downloaded. Files selected but not confirmed are not archived. Files imported before this feature can be added again to build the archive without adding their transactions twice. CSV pasted into the app is saved as a CSV file.

## Findings checked October 10, 2026

- Citizens documents its [Online Banking Document Center](https://www.citizensbank.com/customer-service/faqs/mobile-and-online-banking.aspx) as the place to access statements after signing in.
- Its [mobile app feature guide](https://www.citizensbank.com/learning/top-features-mobile-app.aspx) includes access to paperless statements. The user confirmed PDF sharing/downloading in their app, which takes priority over an older Citizens resource page that says app statements are unavailable.
- Apple documents [launching a shortcut from another app’s share sheet](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios) and [PDF/file input types](https://support.apple.com/guide/shortcuts/understanding-input-types-apd7644168e1/ios).
- Citizens supports [account alerts when an e-statement becomes available](https://www.citizensbank.com/mobile-and-online-banking/online-banking.aspx). Turning this on at the bank reduces checking for a new statement manually.
- The existing native document handoff automatically opens the review after a PDF is sent to GasFinder. It needs the rebuilt app with document registration. Android also accepts PDF/CSV share intents. Free Apple signing uses document opening; the dedicated iOS share extension remains optional for an enrolled team.
- No public authenticated statement-download API was established during this research. A website link or file Shortcut does not provide an authenticated bank connection. The balance is current as of the statement closing date.

## Remaining work

Verify the signed Open File destination and file handoff on the physical phone, including the free-team build, first-run iOS permissions and Share-sheet Favorites. Rebuild the signed asset on macOS with `python3 scripts/sign-statement-shortcut.py` after changing its source. An Apple signing-service failure must not be treated as a successful rebuild.

Unattended download from Citizens is not implemented. It still requires sign-in and opening the statement in the bank’s app. A folder-based newest-statement action can be considered separately if direct Share proves insufficient.
