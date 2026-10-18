# Sample data

Sample previews start visible. **Hide sample data** on Account, Goals, Subscriptions, transaction history, saved imports, or subscription settings hides the previews everywhere. The preference persists across launches; **Show sample data** restores them. Real records remain visible and unchanged.

The previews contain a Citizens-style checking balance and nine movements, a savings goal, and three invented subscription services. They are read-only projections, never seeded into financial stores. They do not contribute to real balances, savings, matching, renewal banners, device reminders, widgets or normal financial exports. Legacy subscription test records are excluded from the live subscription panels as well.

From Account or Saved imports, choose **View sample Citizens statement**. This separate preview can share/download the bundled [synthetic PDF](../assets/samples/sample-citizens-statement.pdf). It is explicitly marked SAMPLE / NOT REAL and not issued by Citizens. September 2026 opening balance $1,200.00 plus its nine signed movements equals closing balance $3,280.54. Previewing does not save an import or update an account. Deliberately importing a downloaded copy still uses the existing import confirmation flow.

The bundled PDF, JSON/base64 copy and deterministic Python generator live in `assets/samples/`. Tests extract the PDF through the actual statement parser and compare the balance and movements with the displayed fixtures.

## Verification — October 18, 2026

- 342 logic tests pass, including Autos URL/price boundaries, shared payload routing, repeated deliveries and sample isolation/reconciliation.
- Expo lint, TypeScript and iOS/Android/web JavaScript exports pass. These exports are not signed native builds.
- Browser inspection at 320 and 1024 CSS pixels, in light and dark appearances, found wrapping controls and readable preview layouts. Account retained its existing transaction when samples were hidden. The sample PDF download link was generated successfully.
- The supplied `/vindp/B0HGBW2WQ3/ref=...` link opened the Toyota Prius title and an empty full-price confirmation field in the browser. No goal or financial record was saved during verification.
- Independent code review found no actionable issue. Physical-device sharing and native extension/WebView acceptance remain unverified; follow [the sharing build and device checks](AMAZON_SHARING.md).
