# Citizens statement download and import

## Current flow

1. In Account, open **Import statement → Get statements from Citizens → Open Citizens website**.
2. Sign in through the bank’s website and open **Document Center**. Download the checking/savings PDF.
3. From the downloaded PDF, use **Share / Open in GasFinder**. If unavailable, save to Files and choose the PDF in GasFinder.
4. Review the per-page counts and closing balance, then confirm. The statement balance is selected by default, including when an older or repeated statement replaces a manual balance. Uncheck it to retain the saved balance.
5. The app creates its **Imports** folder automatically and keeps the original file when the import is confirmed. **Account → Saved imports** allows another review or sharing/downloading the original. Existing transactions and matching app purchases remain deduplicated.

On phones the folder is inside GasFinder’s document storage, with file export through Share. On the web, files are stored in this browser’s IndexedDB and can be downloaded. Files selected but not confirmed are not archived. Files imported before this feature can be added again to build the archive without adding their transactions twice. CSV pasted into the app is saved as a CSV file.

## Findings checked October 10, 2026

- Citizens documents its [Online Banking Document Center](https://www.citizensbank.com/customer-service/faqs/mobile-and-online-banking.aspx) as the place to access statements after signing in.
- Citizens supports [account alerts when an e-statement becomes available](https://www.citizensbank.com/mobile-and-online-banking/online-banking.aspx). Turning this on at the bank reduces checking for a new statement manually.
- The existing native document handoff automatically opens the review after a PDF is sent to GasFinder. It needs the rebuilt app with document registration. Android also accepts PDF/CSV share intents. Free Apple signing uses document opening; the dedicated iOS share extension remains optional for an enrolled team.
- No public authenticated statement-download API was established during this research. A website link or file Shortcut does not provide an authenticated bank connection. The balance is current as of the statement closing date.

## Next improvement to investigate

Prototype an iPhone Shortcut for the downloaded PDF: receive a PDF from the share sheet (or let the user select a statement from Downloads), then open it in GasFinder. Verify the Open File app choice with the free-team build on the actual phone before distributing a signed Shortcut. Use the statement-ready alert as the entry point; keep Citizens authentication and document selection in the bank’s normal flow.

After that prototype, consider a user-selected statement folder with a **Review newest statement** action. Confirm folder access persists on iOS/Android and identify files by contents, rather than a guessed filename. Keep final review of transactions and the dated balance before applying an import. This would reduce file-picker steps; unattended download from Citizens is not implemented.
