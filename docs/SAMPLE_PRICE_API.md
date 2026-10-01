# Sample prices and user reports

The fictional Philadelphia station list now lives in [api-learn](https://github.com/ninofedericodefeo-commits/api-learn). The app reads `GET /v1/stations/sample`, validates the response, and shows its prices as fictional samples. A user can choose **Report a price** for one of those stations; the app sends the entered fuel price to `POST /v1/stations/{id}/prices`. The API saves the report in SQLite and returns it as an unverified community price on later reads. Receipt photos and personal app data stay on the device.

To run both projects locally, start the `api-learn` server according to its README on port 8000. Set `EXPO_PUBLIC_SAMPLE_API_URL=http://localhost:8000` in this app's `.env.local`, then run `npx expo start` in this project. The simulator can reach localhost; a physical phone needs a reachable HTTPS server URL. GitHub hosts the API code, not the running service or its SQLite file.

The API has no authentication, moderation, or rate limits. Keep it local while testing price reports. Before a public deployment, add controls against false or abusive submissions and durable hosted storage. An API failure is shown as an error; the app does not silently substitute bundled prices.
