# Physical phone smoke test

[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) supports Android 7+ and iOS 16.4+. Record the exact device model, OS version, build identifier, tester, and date for each run. The first supported test devices and launch region still need a product decision.

For an iPhone signed by a free Apple Personal Team, regenerate the iOS project after changing native configuration, then install it while the phone is unlocked:

```bash
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

Keep Metro running with `npx expo start --host lan` while using a development build. This Personal Team configuration keeps local subscription reminders but omits Push Notifications and the iPhone goal widget because its App Group cannot be provisioned. Builds signed by an enrolled Apple Developer Program team can opt back into both capabilities with `EXPO_ENABLE_IOS_CAPABILITIES=1` during prebuild and build.

1. Install a development build on each agreed Android and iOS device using the project’s EAS setup (`npx eas-cli@latest build --profile development --platform android|ios` after EAS configuration and sign-in).
2. Open, reload, close, and reopen the app. Confirm real nearby search is offered first and that no location prompt appears until **Find stations near me** is chosen.
3. Grant location, deny it, disable device location services, and change permission later in Settings. Confirm each state is explained and sample data is never shown as an online result.
4. Test fuel, radius, and sort selections; a station with no chosen-fuel price; a stale price; an empty response; and a backend timeout. Confirm displayed distance and lowest-price highlight change correctly.
5. Switch among Gas, Goals, and More. These section changes should have no push animation or growing back stack. Open a receipt from Gas and a tool from More; each detail should slide in and its back button should return to the section that opened it. From Savings pocket, open Savings goals and confirm this selects the existing Goals tab. Rotate or use a tablet if in scope; test small screens, large text, keyboard, and touch targets.
6. Confirm the previous investing demo appears only in the read-only archive under Activity and never counts toward a new goal.
7. Add, skip, and remove a spending-pause entry. Confirm the reported avoided-spending estimate updates and no notification or payment-blocking claim appears.
8. Test with slow and no connectivity. Confirm online failure is clear and the sample path remains available by explicit selection.
9. Open receipts from Gas and from a real station card. Take a receipt photo and choose one from the photo library. Confirm price, station name, fuel, purchase date, and mapped location or address. Attach GPS only while at the station; test location denial and manual address entry. Save, restart, check the report, photo, and linked station price, then delete the report and confirm the linked price disappears.
9a. From Gas, report a price without a receipt using GPS, then using entered coordinates. Edit and delete the saved report. From a mapped station, report a price and confirm it appears on that station and in its local history graph. Confirm changing coordinates removes the mapped link. An unnamed map station should say **Name not listed**. A station without a real price should show **$9.99 · EXAMPLE · NOT REAL** and must not become the lowest price. On a slow connection, check that stations within 2 miles appear while the wider search continues.
10. Enter an account balance, set aside part of it, release part, and restart. Confirm the estimated available amount and history persist. Lower the entered balance below the earmark and confirm the warning. Verify that the screen never suggests money moved or became unavailable at the bank.
11. Add monthly and yearly subscriptions with prices. Test a renewal on the first of a month, a date on the 31st, edit, mark canceled, reactivate, and delete. On the day before renewal, confirm the review asks about each charge and the total. Choose Keep and Plan to cancel; confirm that the latter clearly says to cancel with the provider. Enable phone reminders, grant permission, and confirm a 9 AM local notification is scheduled; disable reminders and confirm scheduled entries are cleared.
12. Create an untimed goal, then a timed goal with a future date. Test title, target, type, and date edits in Settings. Start with money already earmarked in the pocket and test Assign none and Assign all. Confirm no money is added to the pocket by assignment.
13. Log three actual purchases and confirm suggestions adapt, respect the $5 and 10% defaults, and respond to limit changes. Save one suggestion, skip another, and use a custom amount. Edit and delete a purchase; confirmed goal money must remain until explicitly released.
14. Mark a Spending Pause item as bought. Log the actual amount and confirm the purchase appears only once in Savings goals. Also test Bought without logging. Confirm gas receipts do not create goal purchases.
15. Add and release goal money, restart, and confirm goal and pocket totals agree. End a goal, inspect Past goals, then create another with Assign all or Assign none. Ordinary pocket release must never use money assigned to the active goal.
16. On an iPhone build signed by an enrolled Apple Developer Program team with `EXPO_ENABLE_IOS_CAPABILITIES=1`, enable the Savings goal widget in settings, add it to the Home and Lock Screens, and confirm progress changes after setting money aside or reopening the app. The default widget should show only a generic title and percent; enable Show amounts and title to verify the other display. Disable the widget and confirm it hides goal details. On a free Personal Team build, confirm the widget is unavailable and goal progress remains visible inside the app. Check the in-app progress on Android.

For each failure, record steps, expected and actual result, severity, and a screenshot or recording if useful. Do not enter payment credentials or use customer funds.
