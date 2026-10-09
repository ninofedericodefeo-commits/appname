# Gas map and trip planning

Gas opens in **Map**, with an optional **List** view. Select a price marker to see directions, reports and history. Stations arrive from the nearby search progressively. An unknown price is labeled `$9.99*` on the map and **EXAMPLE · NOT REAL** in its card; sample stations are labeled too. Neither fictional prices nor legacy investing data inform trip recommendations. Google-provider results, if configured, stay in List rather than being drawn on an OpenStreetMap basemap.

The map uses bundled Leaflet 1.9.4 in an Expo DOM component, with react-native-webview on iOS/Android and normal DOM on web. Only visible OpenStreetMap tiles are requested, with attribution, native app identification, and normal HTTP caching; no prefetch or offline download. `EXPO_PUBLIC_MAP_TILE_URL` can override the tile endpoint (choose a provider permitting this usage and retain required attribution). No Google map key or paid API is needed. Public tiles, OSRM routing and Overpass station lookup require internet and are best-effort services.

## Save cars once

**Gas on your drive → Manage cars** lets you add, rename, edit or delete multiple cars. Search broad make/model names, such as Subaru Crosstrek; a year or trim is not required. The offline catalog is derived from the latest six model years in the EPA/FuelEconomy.gov public gasoline-vehicle CSV. Drivetrain and door suffixes are grouped; the lowest combined MPG in that group is used as a conservative starting estimate. Hybrid models that have distinct names remain separate. Plug-in hybrids and electric-only cars are excluded. An older or unmatched car can be added with editable generic estimates.

Tank capacity is a **vehicle-class guess**, not an EPA or manufacturer specification. Verify and edit it before using tank percentage. MPG and capacity are visible and editable. Profiles, the selected car, and the most recent destination are stored only on this device; fuel level is deliberately requested for every new drive.

Source: https://www.fueleconomy.gov/feg/ws/index.shtml
Refresh the offline catalog with `python3 scripts/update-vehicle-catalog.py` and review the resulting JSON change.

## Bring a destination from Maps

Apple and Google Maps do not expose another app's current active route. GasFinder accepts a destination shared or pasted by the user and plans its own route from the current location. It remembers the destination; confirm it before planning a different drive. Custom route roads, traffic, intermediate destinations and avoid-toll settings are not imported.

- **All builds:** In Maps, share the destination place, choose Copy, then **Paste from Maps** in GasFinder. Addresses, coordinates, supported full Maps URLs, and short `maps.app.goo.gl`, `goo.gl`, and `maps.apple` links are accepted. Short-link redirects can fail (including browser CORS restrictions); a clear error asks for the destination address instead.
- **Android development build:** Share destination text/URL directly to GasFinder. Expo Sharing's text share intent opens `/on-route` and pre-fills the destination.
- **iPhone with a free Personal Team:** App Groups cannot be provisioned. Direct Expo Sharing is disabled, matching the existing widget/capability configuration. Paste works. For one-tap sharing, create the Shortcut below; no bank, Maps account, paid map API or App Group is required.
- **Enrolled Apple Developer Program build:** `EXPO_ENABLE_IOS_CAPABILITIES=1` enables the Expo Sharing extension, along with the existing widget and push capabilities. Rebuild with the same flag. Sharing is experimental in Expo SDK 57; verify it on the installed build.

### Free iPhone share Shortcut

1. Create a Shortcut named **Gas on my drive** and enable **Show in Share Sheet**.
2. Accept **URLs** and **Text** as input.
3. Add **URL Encode** on **Shortcut Input**, choosing Encode.
4. Add **Text** with `gasfinder://on-route?destination=` followed by the **URL Encoded Text** variable. Do not type the variable's name literally.
5. Add **Open URLs** using that Text.
6. In Maps, share the destination place to **Gas on my drive**. GasFinder opens with that destination; pick your car, choose a tank percent or enter US gallons left, and tap **Plan fuel stops**.

A development app must already have a working Metro connection; a standalone build can cold-launch without Metro. The app never automatically reads the clipboard.

## Multiple stops

Planning converts the one fuel-level entry using the saved car's MPG and capacity. It reduces the estimated range by 15%, then keeps an additional fuel reserve. A search is performed near the next refill point, within the reachable corridor. If that region has no station, earlier reachable sections are searched. A station's estimated extra travel (twice its straight-line route offset) is included in reachability. Reported prices rank candidates near the refill point; unknown prices are ranked by distance. Fictional/sample prices are excluded.

Every selected stop is assumed to **refill to full**. The next search is recalculated from the station actually selected, including the return-to-route offset; long trips keep adding stops until the estimated full-tank range reaches the destination. Stops appear individually as their searches complete. At most 24 stops are planned per trip; a limit, missing stop or service failure explicitly marks the remaining trip as uncovered. An incomplete plan has individual-stop directions but no whole-trip export. A trip with enough fuel performs no station lookup until **Find gas on this trip anyway** is tapped.

Distance to a station is measured from the route geometry, not verified road access. Confirm roads, exits, opening hours and fuel level before driving. OSRM can choose different roads than Maps; the app does not track fuel consumption or trip progress in the background.

## Open in Maps

Apple Maps on iOS 18.4+ accepts all planned waypoints plus the destination through unified `/directions` URLs. Older iPhones use individual-stop directions. Google Maps mobile URLs support at most three waypoints; longer plans are split into numbered parts, preserving every stop and the final destination. Open each next part after completing the prior part. Individual-stop directions always start from your current position.

References:
- https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
- https://docs.expo.dev/guides/dom-components/
- https://developer.apple.com/documentation/mapkit/unified-map-urls
- https://developers.google.com/maps/documentation/urls/get-started
- https://operations.osmfoundation.org/policies/tiles/

## Build and verify

New native dependencies (`expo-sharing`, `expo-clipboard`, `react-native-webview`) require rebuilding the installed development app. For the currently configured free iPhone team:

```bash
npx expo prebuild --platform ios
npx expo run:ios --device
```

Use EAS development builds once an enrolled developer account and EAS profiles are configured. See `PHONE_SMOKE_TEST.md` for physical iPhone/Android checks.

### Verification for this change (October 8, 2026)

- Expo lint and TypeScript checks pass; 53 logic tests pass, including range validation, successive refills, earlier-stop fallback, uncovered legs, fictional-price exclusion, geometry scaling and preservation of all Maps waypoints.
- Web/iOS/Android production bundles including the DOM map export successfully.
- At 390 × 844 in the web preview: default map, sample markers and selection, two saved cars, model estimates, switching cars and persistence after reload were checked.
- A live OSRM Philadelphia-to-Charlotte route measured approximately 533 miles. Real Overpass queries returned 94, 96 and 81 nearby mapped stations in successive search windows; the planner selected BP near mile 88, Exxon near mile 295 and Love’s near mile 498, then marked the trip covered. These are mapped locations, not verified prices or road-access checks.
- Native configuration generated successfully in a disposable checkout: the free-team iPhone has empty entitlements and no Sharing extension; Android has the text share intent. Installed-device Maps/Shortcuts handoff and native map gestures still need the physical-phone smoke test after a rebuild.
