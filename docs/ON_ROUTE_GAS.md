# Gas map and trip planning

Gas opens in **Map**, with an optional **List** view. Select a price marker to see directions, reports and history. Stations arrive from the nearby search progressively. Unknown prices say **Gas** on the map and **No price yet** in their card. The sample-data banner is removed. **Report a price** and **Gas on your drive** sit below the map. Google-provider results, if configured, stay in List rather than being drawn on an OpenStreetMap basemap; choose Nearby map inside Filters to return.

The map uses bundled MapLibre GL JS 6.13.0 in an Expo DOM component, with react-native-webview on iOS/Android and normal DOM on web. OpenFreeMap's Positron style provides vector streets, labels and water with required OpenFreeMap/OpenMapTiles/OpenStreetMap attribution. Price pills, numbered route stops, a blue location dot, zoom controls, recentering and a blue drive route are supported. Selection and price updates preserve the user's map position; a new location or route fits the results. Empty routes clear the route line. The matching module worker is loaded from the pinned official package on UNPKG. OpenFreeMap public hosting is free with no key, registration or billing account. No prefetch or offline download is added. `EXPO_PUBLIC_MAP_TILE_URL` is no longer used. Internet/WebGL are required; loading failures offer Retry and the station List remains available. Public map hosting, OSRM routing and Overpass station lookup are best-effort services.

## Save cars once

**Gas on your drive → Manage cars** lets you add, rename, edit or delete multiple cars. Search broad make/model names, such as Subaru Crosstrek; a year or trim is not required. The offline catalog is derived from the latest six model years in the EPA/FuelEconomy.gov public gasoline-vehicle CSV. Drivetrain and door suffixes are grouped; the lowest combined MPG in that group is used as a conservative starting estimate. Hybrid models that have distinct names remain separate. Plug-in hybrids and electric-only cars are excluded. An older or unmatched car can be added with editable generic estimates.

Tank capacity is a **vehicle-class guess**, not an EPA or manufacturer specification. Verify and edit it before using tank percentage. MPG and capacity are visible and editable. Profiles, the selected car, and the most recent destination are stored only on this device; fuel level is deliberately requested for every new drive.

Source: https://www.fueleconomy.gov/feg/ws/index.shtml
Refresh the offline catalog with `python3 scripts/update-vehicle-catalog.py` and review the resulting JSON change.

## Start with a destination

Open **Gas on your drive**, enter an address, city or coordinates, choose a saved car, and enter its current tank percentage or gallons. Tap **Plan fuel stops**. The result shows suggested stops and an **Open trip** action in the preferred Maps app. On web, enter coordinates; address lookup uses the native iPhone/Android geocoder.

**Settings**, available from Gas and Gas on your drive, saves Apple/Google Maps preference, preferred fuel grade and a refill level (default 10%, adjustable from 5% to 50%). Apple Maps is selectable on iPhone; Android and web use Google. Preference controls both station directions and full-trip handoff.

## Optional destination sharing

Apple and Google Maps do not expose another app's current active route. GasFinder accepts a destination shared or pasted by the user and plans its own route from the current location. It remembers the destination; confirm it before planning a different drive. Custom route roads, traffic, intermediate destinations and avoid-toll settings are not imported.

- **All builds:** In Maps, share the destination place, choose Copy, then **Paste an address or Maps link** in GasFinder. Addresses, coordinates, supported full Maps URLs, and short `maps.app.goo.gl`, `goo.gl`, and `maps.apple` links are accepted. Short-link redirects can fail (including browser CORS restrictions); a clear error asks for the destination address instead.
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

Planning converts the one fuel-level entry using the saved car's MPG and capacity. It reduces estimated range by 15%, then subtracts the chosen refill percentage of the **full tank range** on every leg. With a 300-mile full-tank estimate, 50% remaining and a 10% refill level, the refill target is 120 miles away (150 minus 30). At/below that level, it looks immediately for the nearest reachable stop within 10 miles, retaining 20% of the remaining estimated fuel for the emergency search. This does not claim a normal reserve remains when the starting tank is already too low. A search is performed near the next refill point, within the reachable corridor. If that region has no station, earlier reachable sections are searched. A station's estimated extra travel (twice its straight-line route offset) is included in reachability. Reported prices rank candidates near the refill point; unknown prices are ranked by distance. Fictional/sample prices are excluded.

Every selected stop is assumed to **refill to full**. The next search is recalculated from the station actually selected, including the return-to-route offset; long trips keep adding stops until the estimated full-tank range reaches the destination. Stops appear individually as their searches complete. At most 24 stops are planned per trip; a limit, missing stop or service failure explicitly marks the remaining trip as uncovered. An incomplete plan has individual-stop directions but no whole-trip export. A trip with enough fuel performs no station lookup until **Find gas on this trip anyway** is tapped.

Distance to a station is measured from the route geometry, not verified road access. Confirm roads, exits, opening hours and fuel level before driving. OSRM can choose different roads than Maps; the app does not track fuel consumption or trip progress in the background.

## Routing availability

Driving routes use OSRM with a backup endpoint at FOSSGIS. Native GET and POST requests identify GasFinder, calls are spaced at least 1.1 seconds apart, and up to five recent successful routes are cached in memory for five minutes. Overpass station lookup tries three endpoints. Routing, station-search and destination-geocoding failures are distinguished. A failed station lookup can be retried without reentering the trip; earlier results stay visible until retry begins. No failed request creates fictional stops or a complete trip export. If route lookup fails after the address resolves, the destination can still be opened in Maps with an explicit **without a fuel plan** label.

Public map services can time out or limit requests. They are free for this small personal prototype; availability is not guaranteed. OSRM/FOSSGIS attribution and OpenStreetMap correction links are displayed.

## Open in Maps

Apple Maps on iOS 18.4+ accepts all planned waypoints plus the destination through unified `/directions` URLs. Older iPhones use individual-stop directions. Google Maps mobile URLs support at most three waypoints; longer plans are split into numbered parts, preserving every stop and the final destination. Open each next part after completing the prior part. Individual-stop directions always start from your current position.

References:
- https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
- https://docs.expo.dev/guides/dom-components/
- https://developer.apple.com/documentation/mapkit/unified-map-urls
- https://developers.google.com/maps/documentation/urls/get-started
- https://openfreemap.org/quick_start/
- https://maplibre.org/maplibre-gl-js/docs/

## Keyboard handling

All entry forms, including modal purchase entry and receipt/car editing, use a shared scroll container. iOS adjusts keyboard insets, scrolls the focused input above the keyboard and supports drag dismissal; Android uses a resizing keyboard-avoiding container. Verify the actual keyboard on iPhone/Android, including moving between fields while it is already open.

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

### Destination flow and settings verification

- 64 tests pass, including full-tank refill math, changed thresholds on successive legs, near-empty starts, Maps preference defaults, HTTP fallback, caching, React Native AbortController compatibility, cancellation, timeout and malformed-response handling.
- iOS, Android and web bundles export; lint and TypeScript pass.
- Mobile web preview: destination-first form, saved refill preference after reload and invalid refill input checked. Native keyboard behavior and Maps app handoff still require the physical-phone checks below.
- A live 533-mile Philadelphia-to-Charlotte route with a 25%-full estimated Subaru and 10% refill level returned Flying J near mile 45 and BP near mile 343. The primary station lookup returned HTTP 504; the backup succeeded. These are mapped stations with unknown prices, not verified road access or pump prices.

### Account/Gas cleanup verification (October 10, 2026)

- MapLibre/OpenFreeMap Positron loads in the mobile web preview without a key. Synthetic Philadelphia points verify priced/unknown numbered markers, selected state, price updates with unchanged camera, route line clearing, zoom and recenter. Gas has no sample-data banner; both gas actions sit below the map.
- Lint, TypeScript, 113 logic tests and iOS/Android/web exports pass. Installed iPhone/Android status-bar positioning, WebGL/module-worker loading, offline Retry, pinch zoom and scrolling remain physical-device checks.
