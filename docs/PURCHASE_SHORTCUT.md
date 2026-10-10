# Apple Pay purchase logging

In Goals, open **Connect Apple Pay purchases**. The guide remembers the current step locally, so leaving the app does not lose your place. **Add shortcut** shares a signed, bundled `GasFinder Log Purchase.shortcut` file using the existing Expo Sharing module. Choose Shortcuts, then Add Shortcut. If Shortcuts is missing, save it to Files and open the file. No API key, bank login or paid service is used.

After the file handoff, the guide moves to **Connect your card**. This is a guide step, not an installation check: canceling the sheet also returns here, and **Didn’t add the shortcut? Go back** restores installation. People with an existing shortcut can skip the import.

Apple still requires choosing a Wallet card and saving its Transaction automation on the iPhone. There is no documented URL to select that card or enable the trigger from another app. On iOS 27, **Set up automation** uses Apple's documented `shortcuts://open-shortcut?name=GasFinder%20Log%20Purchase` URL to open the imported shortcut directly. The guide shows the exact tap paths for Edit → Automation → Transaction and Privacy → Allow Running When Locked. On earlier versions, the button opens Shortcuts and the guide shows Automation → + → Transaction, Run Immediately, and choosing the existing shortcut. No logging actions need to be authored manually. The layout selector allows switching between those instructions.

Returning from Shortcuts automatically moves to **Check your first purchase**. If iOS doesn't deliver a foreground event, **I saved the automation** does the same. Neither return nor confirmation is treated as proof that automation is enabled. Only a newly received shortcut purchase, timestamped after the check began, changes the card to **Purchase received**. Existing imports and manual entries do not count. This confirms an incoming purchase, not a verified Wallet connection. **Finish or change card setup** returns to the card guide. Starting the guide again does not disable or delete any iOS automation.

The shortcut extracts the numeric Amount, Merchant and Currency Code, URL-encodes them and opens `gasfinder://import-purchase`. The app rejects non-USD currency, validates the amount and merchant, deduplicates repeat opens within the same minute when no source ID is supplied, records the purchase locally and applies the active goal's rule to the set-aside estimate. It does not convert currencies or move bank funds. Unsupported purchases can still be logged in Account → Transactions or Edit goal.

## Maintaining the template

- Reviewable source: `assets/shortcuts/log-purchase.workflow.json`.
- Bundled signed file, encoded for local delivery: `assets/shortcuts/log-purchase.signed.json`.
- Regenerate on macOS with `python3 scripts/sign-purchase-shortcut.py`. The system `shortcuts sign --mode anyone` command sends the template (not user transactions) to Apple for validation. Never embed a person's transaction, card details or contact information in this template.

## Phone verification

1. Import with the app button and inspect the encoding actions: Amount and Merchant must refer to Shortcut Input.
2. Enable a Transaction automation for a USD Wallet card and pass its transaction input.
3. After a real supported tap, verify merchant, actual amount and rule-based savings contribution in Account → Transactions.
4. Reopen the same link within the minute: one purchase and one savings contribution only.
5. Cancel installation, go back and retry; ensure no installed/enabled status appears. Check unavailable Shortcuts/file-sharing errors.
6. Return from card setup, including cancellation: the guide waits for a purchase rather than declaring the automation connected. Reopen the page/app to check the saved guide step.
7. Confirm a manual purchase and an old shortcut import cannot satisfy the new-purchase check. Change the instruction layout and check the older iOS route.

Template signing and macOS import preview are checked during development. Real Wallet taps and the iPhone share-sheet handoff need physical-device verification; desktop testing cannot supply a real Wallet transaction.

Apple references: [Transaction trigger](https://support.apple.com/guide/shortcuts/apd65c67538a/ios), [iOS 27 automation setup](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/10.0/ios/27), [iOS 26 automation setup](https://support.apple.com/guide/shortcuts/apdfbdbd7123/9.0/ios/26), [open a named shortcut](https://support.apple.com/guide/shortcuts/apda283236d7/10.0/ios/27), [shortcut signing](https://support.apple.com/guide/shortcuts-mac/apd455c82f02/mac).
