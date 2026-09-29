# Online stations contract and release gate

The app starts in **Philadelphia sample** mode. Sample stations and prices are fictional. Setting `EXPO_PUBLIC_STATIONS_API_URL` exposes a separate **Search near me** action; it does not turn sample records into online results. [Expo embeds `EXPO_PUBLIC_` values](https://docs.expo.dev/guides/environment-variables/) in the app bundle, so this variable may contain only a public HTTPS backend URL. Keep provider credentials on the backend.

## Backend request

`GET {EXPO_PUBLIC_STATIONS_API_URL}/v1/stations/nearby?latitude=39.95&longitude=-75.16&radiusMiles=5&fuelType=regular`

- Coordinates are device location after foreground permission. Radius is in miles and fuel type is `regular`, `midgrade`, `premium`, or `diesel`.
- Backend should enforce geographic bounds, request limits, caching, provider timeout, and provider usage terms. It should return `200` with `{ "stations": [...] }` for a valid empty result.
- Mobile requests time out after 10 seconds. Non-2xx responses, invalid records, and timeouts show an error; the client never substitutes sample prices for an online failure.

## Response

```json
{
  "stations": [
    {
      "id": "provider-station-id",
      "name": "Example Fuel",
      "latitude": 39.95,
      "longitude": -75.16,
      "address": "1 Example St",
      "city": "Philadelphia",
      "state": "PA",
      "prices": [
        {
          "fuelType": "regular",
          "price": 3.49,
          "currency": "USD",
          "reportedAt": "2026-09-28T14:00:00Z",
          "source": "Provider display name"
        }
      ]
    }
  ]
}
```

Omit a fuel price when it is unavailable. The app calculates distance and radius filtering from station coordinates. Price cards display the source and reported age; reports older than 24 hours are marked stale. A report more than five minutes in the future is marked as having an unavailable time. The backend must supply the attribution text required by its provider and must avoid retaining location longer than needed for the request.

## Release decision

No provider has been selected or approved. Before configuring an endpoint for users, choose a launch geography and verify station coverage, price freshness, display rights, attribution, rate limits, cost, outage ownership, and support handling. Test missing prices, stale reports, malformed data, empty results, timeouts, and permission denial on physical phones. The current endpoint integration is a client contract, not a claim that real prices are available.
