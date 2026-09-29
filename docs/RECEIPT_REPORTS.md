# Receipt price reports

The mobile app lets a user photograph or choose a gas receipt, then confirm the station name, address or current GPS position, fuel type, price per gallon, optional gallons and total, and purchase date. It stores the photo in the app's document directory and the details in local device storage. Deleting a report removes its app-managed photo. The user should cover payment details before photographing.

The app does not run OCR or publish the report. Manual confirmation avoids claiming that text or location was extracted from a receipt when it was not. Current GPS should be attached only at the station; otherwise the user enters the address. If the app is uninstalled or device data is cleared, reports may be lost.

To make these reports visible to other users, build a backend that accepts authenticated image uploads and report metadata, strips unnecessary image metadata, scans and limits uploads, checks location and arithmetic, detects duplicates and abuse, supports corrections and deletion, and sets retention limits. Serve reviewed, timestamped prices through the existing station API with source and freshness labels. Add OCR as a suggestion step only, with user review before submission. A real provider or verified community feed is still needed for broad price coverage.
