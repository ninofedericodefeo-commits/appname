# Gas search areas and saved stations

Implemented October 14, 2026, as the UX-04 / GAS-01 batch. No new dependency or native capability is required.

## Main flow

- Gas shows **Search near**, area selection, GPS status and Filters above Map/List. Fuel, radius, sorting and hiding unpriced stations remain adjacent to the map.
- **Search an area / Change area** accepts city, ZIP, address or `latitude, longitude`. Text lookup runs only after **Find area**. Choose a result explicitly; similar names include coordinates for comparison. Invalid coordinates do not trigger a lookup.
- **Use GPS** is optional. A failed/denied request preserves the chosen area and existing results. A manual selection invalidates any older pending GPS request so its late result cannot replace the choice.
- The last area is restored at launch. A previous GPS check has a dated label, rather than being presented as a new current location. First launch without a saved area still attempts the existing foreground GPS flow; manual search remains available.
- Pan or zoom the retained Leaflet map at local zoom (8 or above), then tap **Search this area**. Movement alone does not send a station request or change the active search center. The chosen center is labeled **Map area** with coordinates; the map's center dot means Search center, not the user's live position.
- Station distances are straight-line miles from the chosen center. They are not driving distance or distance from a silently assumed GPS position.
- Save an OpenStreetMap station from its detail/list card. Saved stations appear in Change area with **Search around this station** and **Unsave station**. Up to 50 identities/locations are retained. A saved station does not copy a price: removing a receipt/price report cannot leave that copied value behind.
- Recent manual/map areas are deduplicated and capped at five. Changing an area preserves the Map/List choice. Report a price and Gas on your drive stay below the map and above List rows; My cars shows the selected car and Manage. Choose another saved car in Manage or trip planning.

## Services and storage

Submitted place text uses the [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md) at `https://photon.komoot.io/api/`. The sheet explains that text is sent to Photon. It sends no GPS bias or bank information. Coordinates and already saved choices require no geocoder request.

Photon's [public demo service](https://github.com/komoot/photon#demo-server) permits reasonable project usage, may throttle requests, and offers no availability guarantee. GasFinder serializes explicit requests, spaces their start by at least 1.1 seconds, requests at most five matches, applies a 12-second timeout and cancels abandoned requests. Native requests identify GasFinder. There is no keystroke autocomplete or background lookup. Up to 20 query results are saved locally; their date is shown when reused and **Search online again** allows a deliberate refresh. `EXPO_PUBLIC_PLACE_SEARCH_URL` can select another compatible HTTPS endpoint; it is a public configuration value, not a secret.

OpenStreetMap station discovery retains its progressive 2-mile / selected-radius search and service failover. Up to six successful station-search snapshots (200 stations each) are persisted in `gasfinder-gas-search` with the center, covered radius and fetch date. Failed requests do not create snapshots. Google provider results are not persisted or offered as saved stations.

Saved results appear immediately while refreshing and remain usable when refresh fails. The notice gives the original save time and partial coverage, with Retry. A new inner search can replace inner records while retaining older wider coverage until a full search succeeds; IDs are merged once. Switching areas never presents another area's cache as nearby results. Distances and selected-fuel filtering are recalculated, local reports overlay source data, and prices retain their original timestamps/freshness. A cached empty result is labeled as saved, not proof that no current stations exist.

This is a local result cache, not offline map downloading or a live fuel-price feed. Map tiles still require connectivity and are not bulk downloaded. List and saved area choices remain the fallback. Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

The separate version-1 Gas search store leaves financial stores unchanged. Search history and locations are local app data; no sync or portable backup is implemented in this batch.

## Verification

- All 223 logic tests, lint and TypeScript pass; iOS, Android and web exports succeed.
- Logic coverage includes coordinate bounds/no-request behavior, response validation, explicit request limits/spacing/headers, cancellation with React Native's AbortController, service failure, bounded recent areas/caches, exact-area coverage, mixed fresh/cached result merging, original price ages and favorite toggling without copied prices.
- At 390/320 px, browser checks used a public Philadelphia search, not the user's location. They verified GPS-unavailable fallback, real place choices, cached place reuse, direct/invalid coordinates, recent-area selection, station/distance display, saved station controls, area/result persistence after reload, map pan then explicit search, and unpriced-filter recovery above the map.
- Native GPS permission/accuracy, late GPS versus manual selection, cold launch with airplane mode, map WebView gestures, keyboard/safe areas, large text and screen-reader acceptance remain physical-device checks in [PHONE_SMOKE_TEST.md](PHONE_SMOKE_TEST.md). Browser/module tests do not establish native verification.
