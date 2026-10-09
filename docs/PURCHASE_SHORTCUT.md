# Apple Pay purchase logging

In Goals, open **Connect Apple Pay purchases**. **Add logging shortcut** shares a signed, bundled `GasFinder Log Purchase.shortcut` file using the existing Expo Sharing module. Import it in Shortcuts; if the share sheet does not list Shortcuts, save it to Files and open the file. No API key, bank login or paid service is used.

Apple still requires choosing a Wallet card and enabling its Transaction automation on the iPhone. On iOS 27, edit the imported shortcut and add the Transaction automation. On earlier versions, create a Transaction automation and select the imported shortcut, passing the transaction as Shortcut Input. Returning from the share sheet does not prove installation.

The shortcut extracts the numeric Amount, Merchant and Currency Code, URL-encodes them and opens `gasfinder://import-purchase`. The app rejects non-USD currency, validates the amount and merchant, deduplicates repeat opens within the same minute when no source ID is supplied, records the purchase locally and applies the active goal's rule to the pocket estimate. It does not convert currencies or move bank funds. Unsupported purchases can still be logged in Edit goal.

## Maintaining the template

- Reviewable source: `assets/shortcuts/log-purchase.workflow.json`.
- Bundled signed file, encoded for local delivery: `assets/shortcuts/log-purchase.signed.json`.
- Regenerate on macOS with `python3 scripts/sign-purchase-shortcut.py`. The system `shortcuts sign --mode anyone` command sends the template (not user transactions) to Apple for validation. Never embed a person's transaction, card details or contact information in this template.

## Phone verification

1. Import with the app button and inspect the encoding actions: Amount and Merchant must refer to Shortcut Input.
2. Enable a Transaction automation for a USD Wallet card and pass its transaction input.
3. After a real supported tap, verify merchant, actual amount and rule-based pocket change in Activity.
4. Reopen the same link within the minute: one purchase and one pocket change only.
5. Cancel installation, retry installation, and check unavailable Shortcuts/file-sharing errors.

Template signing and macOS import preview are checked during development. Real Wallet taps and the iPhone share-sheet handoff need physical-device verification; desktop testing cannot supply a real Wallet transaction.

Apple references: [Transaction trigger](https://support.apple.com/guide/shortcuts/apd65c67538a/ios), [iOS 27 automation setup](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/10.0/ios/27), [shortcut signing](https://support.apple.com/guide/shortcuts-mac/apd455c82f02/mac).
