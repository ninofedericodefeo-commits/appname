# Physical phone smoke test

[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) supports Android 7+ and iOS 16.4+. Record the exact device model, OS version, build identifier, tester, and date for each run. The first supported test devices and launch region still need a product decision.

1. Install a development build on each agreed Android and iOS device using the project’s EAS setup (`npx eas-cli@latest build --profile development --platform android|ios` after EAS configuration and sign-in).
2. Open, reload, close, and reopen the app. Confirm the Philadelphia sample label and that no location prompt appears until **Search near me** is chosen.
3. Grant location, deny it, disable device location services, and change permission later in Settings. Confirm each state is explained and sample data is never shown as an online result.
4. Test fuel, radius, and sort selections; a station with no chosen-fuel price; a stale price; an empty response; and a backend timeout. Confirm displayed distance and lowest-price highlight change correctly.
5. Move among Gas prices, Receipt report, Savings pocket, and the older Investing demo. Rotate or use a tablet if in scope; test small screens, large text, keyboard, and touch targets.
6. Create a demo contribution and withdrawal, restart, check totals, filter the ledger, and remove an entry. Confirm a contribution that has already been withdrawn cannot be removed until the withdrawal is restored.
7. Add, skip, and remove a spending-pause entry. Confirm the reported avoided-spending estimate updates and no notification or payment-blocking claim appears.
8. Test with slow and no connectivity. Confirm online failure is clear and the sample path remains available by explicit selection.
9. Take a receipt photo and choose one from the photo library. Confirm price, station name, fuel, purchase date, and address. Attach GPS only while at the station; test location denial and manual address entry. Save, restart, check the report and photo, then delete both.
10. Enter an account balance, set aside part of it, release part, and restart. Confirm the estimated available amount and history persist. Lower the entered balance below the earmark and confirm the warning. Verify that the screen never suggests money moved or became unavailable at the bank.

For each failure, record steps, expected and actual result, severity, and a screenshot or recording if useful. Use sample data only; do not enter real payment credentials or use customer funds.
