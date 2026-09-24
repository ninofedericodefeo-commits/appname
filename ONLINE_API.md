# Online station API

The app uses a REST API instead of bundled station data. Set `EXPO_PUBLIC_API_URL`
in `.env.local` (copied from `.env.example`) before starting Expo.

## Request

The app sends:

```text
GET {EXPO_PUBLIC_API_URL}/stations/nearby
  ?lat={latitude}
  &lng={longitude}
  &radiusMiles={radius}
  &fuelType={fuelType}
```

`fuelType` is one of `regular`, `midgrade`, `premium`, or `diesel`.

## Response

Return either an array of stations or an object containing a `stations` array:

```json
{
  "stations": [
    {
      "id": "station-123",
      "name": "Example Fuel",
      "brand": "Example",
      "latitude": 39.9526,
      "longitude": -75.1652,
      "address": "123 Market St",
      "city": "Philadelphia",
      "state": "PA",
      "zipCode": "19103",
      "amenities": {
        "carWash": false,
        "convenienceStore": true,
        "restrooms": true
      },
      "distanceMiles": 0.8,
      "prices": [
        {
          "fuelType": "regular",
          "price": 3.19,
          "currency": "USD",
          "reportedAt": "2026-09-24T16:00:00.000Z",
          "source": "provider-name"
        }
      ]
    }
  ]
}
```

The API should handle authentication, provider-specific price imports, rate
limits, and CORS/server-side proxying. Do not put private API keys in
`EXPO_PUBLIC_*` variables because Expo embeds them in the application bundle.
