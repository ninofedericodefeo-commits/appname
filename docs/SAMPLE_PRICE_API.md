# Sample prices and user reports

The fictional Philadelphia station list now lives in [api-learn](https://github.com/ninofedericodefeo-commits/api-learn). The app reads `GET /v1/stations/sample`, validates the response, and shows its prices as fictional samples. A user can choose **Report a price** for one of those stations; the app sends the entered fuel price to `POST /v1/stations/{id}/prices`. The API saves the report in SQLite and returns it as an unverified community price on later reads. Receipt photos and personal app data stay on the device.

To run both projects locally, start the `api-learn` server according to its README on port 8000. Set `EXPO_PUBLIC_SAMPLE_API_URL=http://localhost:8000` in this app's `.env.local`, then run `npx expo start` in this project. The simulator can reach localhost. GitHub hosts the API code, not the running service or its SQLite file.

For a development build on a phone connected to the same Wi-Fi as your Mac, start `api-learn` with `uv run --frozen uvicorn app:app --host 0.0.0.0 --port 8000`. Set `EXPO_PUBLIC_SAMPLE_API_URL` to `http://<your Mac's LAN IP>:8000` and restart Expo. Use your Mac's actual private address, such as `192.168.x.x`; `localhost` on the phone means the phone itself. The app allows local HTTP only in development, and its native local-network settings require a new development build after this change. Keep the API on a trusted local network because its write route has no authentication.

The API has no authentication, moderation, or rate limits. Keep it local while testing price reports. Before a public deployment, add controls against false or abusive submissions and durable hosted storage. An API failure is shown as an error; the app does not silently substitute bundled prices.

Each station card has **View price history**. The graph offers 7 days, 30 days, 90 days, and all time for the selected fuel. It reads saved reports from `GET /v1/stations/{id}/prices/history` and excludes fictional seed prices. A new report refreshes both the station list and any cached history. The graph is empty until a price has been reported.
