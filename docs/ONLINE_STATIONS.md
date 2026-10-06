# Online station search

GasFinder opens with a free OpenStreetMap nearby search. The separate, optional Google Places mode is backed by [Google Places (New) Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search). Google results can include provider fuel reports, but many stations have no fuel price. The app shows their locations with “Price unavailable” instead of inventing a value. Prices include the provider's update time; reports older than 24 hours are marked stale.

## Try it in an iOS simulator

1. For no cost testing, get a [Maps Demo Key](https://developers.google.com/maps/demo-key). Google lists Places API (New) as supported, requires no billing information, and pauses use at its daily quota. The demo key is restricted to evaluation and testing, even when you are the only user. Google does not explicitly confirm that the demo key returns the `fuelOptions` field used for prices, so verify it with a real request. If that field is unavailable, the app cannot get Google fuel prices through the demo key.
2. Copy `.env.example` to `.env.local`. Set `GOOGLE_PLACES_API_KEY` to your demo key there. Leave `EXPO_PUBLIC_STATIONS_API_URL=http://localhost:8787` for the iOS simulator. Never prefix the key with `EXPO_PUBLIC_`, commit it, or put it in the app binary.
3. In one terminal, run `npm run stations:dev`. In another, run `npx expo start`, open the iOS simulator, and choose **Search near me**. You can set the simulator's location under **Features → Location**.
4. Check `http://localhost:8787/health`. It reports `ready` when the server key is present, or `missing-key` otherwise. It does not verify that Google accepts the key.

The server searches up to 25 miles and returns at most 20 stations per request. It discards stations outside the US because the current UI labels prices in USD per gallon. It requests fresh data per search, keeps no station database, caps searches at 100 per day by default, and returns `Cache-Control: no-store`. The cap is in memory and resets on server restart; it is a local development budget guard, not production abuse protection.

## Test on a physical phone or publish

`localhost` on an iPhone is the phone itself. Host `server/index.mjs` behind HTTPS and set `EXPO_PUBLIC_STATIONS_API_URL` to that public URL when building the app. Keep `GOOGLE_PLACES_API_KEY` only in the server environment. Add authentication or another abuse control and persistent usage limits before exposing the endpoint publicly, and restrict the Google key according to [Google's API key security guidance](https://developers.google.com/maps/api-security-best-practices). Verify actual fuel-price coverage, units, timestamps, and billing with the intended launch area and a real provider response. No Google key or hosted endpoint is included in this repository, so live results cannot be verified from source alone.

For ongoing use, Google says the demo key cannot be used in production. A standard Places key needs billing enabled. Requests for `fuelOptions` use the [Nearby Search Enterprise + Atmosphere SKU](https://developers.google.com/maps/documentation/places/web-service/nearby-search); Google currently lists a monthly free usage cap, but usage beyond that cap is billable. For a no-billing app, use OpenStreetMap station lookup and locally saved receipts instead of enabling Google Places.

Google Maps attribution and any place-specific provider attributions are shown with results. Before release, include the required Google Maps [terms and privacy disclosures](https://developers.google.com/maps/documentation/places/web-service/policies) in the app's public legal pages. Receipt photos remain on the device; a receipt linked to a station can provide a local price in the app's list, without changing the provider response or uploading the report.

## App service contract

`GET {EXPO_PUBLIC_STATIONS_API_URL}/v1/stations/nearby?latitude=39.95&longitude=-75.16&radiusMiles=5&fuelType=regular`

The JSON response has `provider: "Google Maps"` and `stations: [...]`. Each station has a stable ID, name, coordinates, address, city, state, `prices`, and optional `attributions`. Each price has a fuel type, USD amount, report timestamp, and source. An empty `prices` array is valid. The client validates records, computes distance, and sorts by price or distance. Backend errors, timeouts, and invalid data appear as errors; sample prices are never substituted for an online failure.
