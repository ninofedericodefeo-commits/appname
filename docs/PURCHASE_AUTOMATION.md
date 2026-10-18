# Local purchase automation

Goals have a fixed-dollar, percentage, or round-up rule chosen during setup and editable later. Each manually logged purchase or explicitly saved Shortcut draft applies that rule to the **estimated pocket**, capped by the remaining goal and any available balance the user entered. A queued draft or purchase link alone changes no financial records. Unlock GasFinder, check the merchant and amount, then tap **Save purchase**. Canceling changes no financial records. If the rule would set aside nothing or the cap is exhausted, the saved purchase remains pending for a manual decision. No money is transferred, and the manually entered bank balance is not updated by a purchase.

## Capture without opening GasFinder: App Intent

The previous shortcut's **Open URLs** action attempted to open GasFinder at checkout. In the reported failure, iOS said GasFinder was locked even though the iPhone was unlocked and GasFinder had no Face ID or app lock enabled. The exact cause has not been established. The new action avoids that foreground app-opening handoff. **Allow Running When Locked** permits eligible background shortcut actions; it does not override system authentication requirements.

A new native iPhone build includes the **Queue purchase for review** App Intent. This action queues untrusted purchase details locally without opening GasFinder. It is not available in an older installed binary, Expo Go, or through a JavaScript-only update. Install the updated build and open it once while unlocked before configuring the action.

1. Open Shortcuts and edit the existing **Transaction** automation, or create one for the Wallet card you pay with. Choose **Run Immediately** where offered.
2. Remove **Open URLs**, **Open App**, and any **Run Shortcut** action that invokes the old **GasFinder Log Purchase** shortcut. Updating the app does not replace existing automations, and leaving both paths enabled can cause duplicate capture attempts.
3. Add **GasFinder → Queue purchase for review**.
4. Set **Merchant** to **Shortcut Input → Merchant**. Set **Amount** to **Shortcut Input → Amount → Currency Amount**. Set **Currency** to **Shortcut Input → Amount → Currency Code**. Use variables from the real Transaction trigger, not typed labels or a formatted currency string. Only positive USD amounts are accepted.
5. Leave the optional transaction identifier blank unless the trigger supplies a stable identifier. Never supply the card number. Enable **Allow Running When Locked** if offered, then save the automation.
6. After a supported real Wallet tap, unlock and open GasFinder. Review the queued purchase before saving it. A queued item is not a financial transaction until explicitly saved in the foreground.

The phone must have been unlocked at least once since restarting before background capture can access its protected local queue. Queued drafts expire after 30 days. They are excluded from backups. **Erase all app data** clears them; account reset and backup restore retain them until reviewed or expired. The action is bounded local capture, not a notification, an app launch, or a bank connection. iOS can impose additional restrictions; locked-phone delivery must be tested on the actual installed build and device. A manual Play run without Transaction input is not proof that the Wallet trigger works. No additional purchase is necessary just to test setup.

## Older shortcut: foreground review only

The bundled, signed **GasFinder Log Purchase.shortcut** remains a compatibility option for an **unlocked phone**. It creates a `gasfinder://import-purchase?amount=…&merchant=…` URL and uses **Open URLs**. On older Shortcuts, a **Run Shortcut** action must pass **Shortcut Input**. This path does not solve locked-phone capture and is not automatically migrated when the app updates.

The optional `&id=` URL parameter can carry a stable transaction identifier to prevent duplicate imports; without it, repeated links for the same merchant and amount within one minute are treated as one purchase. The app rejects an empty merchant and zero or invalid USD amount. The link prepares a review; it never silently saves a purchase.

Development builds require an available dev server for the JavaScript review screen. Use a standalone installed build for normal closed-app use. The custom `gasfinder` scheme is in `app.json`; a test link such as `gasfinder://import-purchase?amount=4.25&merchant=Test%20purchase` opens a draft on a compatible installed build and still requires explicit foreground confirmation.

## Coverage and disabling

Apple's Transaction trigger covers the selected card being tapped with the iPhone. It does not provide every card, online, cash, or physical-card purchase. Full account history would require a separate authorized provider or eligible FinanceKit integration; neither is configured here. Do not describe this as full transaction syncing.

Disable the Transaction automation in Shortcuts to stop future captures. Restarting GasFinder's setup guide does not disable or delete an existing automation.

References: [Apple Transaction triggers](https://support.apple.com/guide/shortcuts/apd65c67538a/ios), [Apple automation setup and locked-running setting](https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios), [App Intent foreground behavior](https://developer.apple.com/documentation/appintents/appintent/openappwhenrun).
