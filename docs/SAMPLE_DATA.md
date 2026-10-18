# Sample data

Sample previews start visible. **Hide sample data** on Account, Goals, Subscriptions, transaction history, saved imports, or subscription settings hides the previews everywhere. The preference persists across launches; **Show sample data** restores them. Real records remain visible and unchanged.

The previews contain a Citizens-style checking balance and nine movements, a savings goal, three invented subscription services, three individual gas stations, a car, three fill-ups and digital receipts, fuel statistics, a completed goal and spending insights. They are read-only projections, never seeded into financial stores. They do not contribute to real balances, savings, matching, renewal banners, device reminders, widgets or normal financial exports. Legacy subscription test records are excluded from the live subscription panels as well.

Choose **Explore sample data** from any visible sample control for a guide to the examples. Gas shows fictional station cards even without an area search or network results. Open one for all four fuel prices, amenities, a dated price-history chart, detour-cost comparison and sample fill-up. Fictional stations have no map coordinates and cannot be used for navigation or public reporting. Real station searches continue independently.

Cars, Fuel reports, Insights and Past goals display their own labeled examples. Sample receipt and supporting-transaction links open separate read-only detail pages. Fuel costs and measured MPG use the existing calculations on sample fill-ups only. Sample spending categories reconcile to the bundled Citizens statement and exclude the sample savings transfer. **Hide sample data** removes these previews, including open sample details, without deleting real records.

From Account or Saved imports, choose **View sample Citizens statement**. This separate preview can share/download the bundled [synthetic PDF](../assets/samples/sample-citizens-statement.pdf). It is explicitly marked SAMPLE / NOT REAL and not issued by Citizens. September 2026 opening balance $1,200.00 plus its nine signed movements equals closing balance $3,280.54. Previewing does not save an import or update an account. Deliberately importing a downloaded copy still uses the existing import confirmation flow.

The bundled PDF, JSON/base64 copy and deterministic Python generator live in `assets/samples/`. Tests extract the PDF through the actual statement parser and compare the balance and movements with the displayed fixtures.

## Verification — October 18, 2026

- 357 logic tests pass, including URL/price boundaries, shared payload routing, sample statement reconciliation, fractional-cent station prices, detour costs, fuel/MPG calculations and fixture isolation.
- Expo lint, TypeScript and iOS/Android/web JavaScript exports pass. These exports are not signed native builds.
- Browser inspection at 320 and 1024 CSS pixels, in light and dark appearances, found wrapping controls and readable preview layouts. Account retained its existing transaction when samples were hidden. The sample PDF download link was generated successfully.
- The supplied `/vindp/B0HGBW2WQ3/ref=...` link opened the Toyota Prius title and an empty full-price confirmation field in the browser. No goal or financial record was saved during verification.
- Independent code review found no actionable issue. Physical-device sharing and native extension/WebView acceptance remain unverified; follow [the sharing build and device checks](AMAZON_SHARING.md).

## Safe areas and tab naming — October 18 follow-up

The abbreviated **Subs** tab is now **Bills**, including its accessible label and screen heading. Routes and saved subscriptions retain their existing identifiers.

A stable root safe-area provider is seeded with `initialWindowMetrics` and stays mounted outside storage-recovery and privacy gates. Headerless Gas, Account, Goals and Bills shells apply context insets during rendering rather than waiting for a native safe-area padding update after mounting. Native-header sample pages omit the extra top inset and duplicate toolbar. The suspected first-launch inset timing issue is inferred from source, not a confirmed reproduction of the reported Dynamic Island overlap.

Browser inspection covered populated station/receipt pages in light and dark themes at 320 and 1024 CSS pixels. Global hiding was exercised from a station detail, and an existing Account record stayed visible. Native simulator UI control was unavailable, so a Dynamic Island phone still needs cold launch, tab switches, back navigation, background/foreground and rotation checks. Web results do not establish native safe-area behavior.
