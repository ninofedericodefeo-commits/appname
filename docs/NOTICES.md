# Bottom notices

Passive green completion and successful provider-opening messages dismiss after three seconds. Screen readers receive at least ten seconds; Android's recommended accessibility timeout can extend this. Hidden-transaction Undo messages remain for five seconds, with the same accessibility extension. Error or unsuccessful provider-opening messages use a warning color and remain dismissible rather than disappearing before recovery.

Root notices share a normal-flow bottom area below the navigator, so they stack without covering each other or the tabs. Bottom and side safe-area insets protect the home indicator. Long messages wrap and can scroll within a bounded notice. Keyboard avoidance is enabled only while a notice exists, so ordinary forms do not acquire an empty keyboard-sized gap.

Timers cancel on unmount and replacement. A new delivery, including a repeated message, gets a fresh interval. The timer adapters preserve the browser's native timer calling convention.

Sample-data controls are separate persistent controls. They now appear at the end of each screen's scrollable content or list footer, rather than above the main content.

Verification: timer tests cover replacement, cleanup, accessibility timing and browser timer invocation. Browser checks at 320 and 1024 CSS pixels in dark/light themes confirmed wrapping, visible bottom controls and automatic dismissal. Manual app association was exercised without saving a bill, and sample map markers opened the matching real station. Native keyboard/home-indicator behavior and Android inventory require installed-device acceptance. A temporary verification route was removed before export.

Final integrated checks: 366 logic tests, Expo lint, TypeScript and iOS/Android/web JavaScript exports pass. Config introspection confirms the Android MAIN/LAUNCHER query without QUERY_ALL_PACKAGES. Android native compilation was not available in this workspace; JavaScript exports do not establish native inventory behavior.
