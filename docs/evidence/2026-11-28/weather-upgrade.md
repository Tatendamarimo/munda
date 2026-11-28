# Weather upgrade — 28 November 2026

The web and bundled iOS interface now have a dedicated, opt-in weather card: current temperature/condition, humidity and wind (km/h), seven daily high/low temperatures, precipitation (mm), maximum precipitation probability (%), provider credit, selected area, fetch freshness, and explicit offline/stale labels. The forecast strip scrolls within the card on phones. Weather can be enabled from Home or disabled in Me. Location remains an explicit foreground action and only the selected approximate area is used.

## Data behaviour

Open-Meteo is the existing provider. Requests use `timezone=auto`, explicit km/h wind units and seven days. Daily labels are filtered against the forecast area's calendar date. Missing values display as unknown rather than zero. Forecasts older than 24 hours are hidden; those older than 3 hours are marked for refresh. A failed refresh can retain the same area's cache. Changing area invalidates the old area's weather even offline. Opting out or changing area during a fetch prevents an old response from restoring weather. Network requests have a 12-second combined timeout.

The header's former sun/rain hint used a future rain threshold as a current icon. It has been removed in favour of actual current WMO condition codes in the card. iPhone Home header padding now includes the safe-area top inset. First-run safe-area spacing was already handled in the initial iOS change.

## Verification

- 207 web tests passed across 29 files; production build passed. Android unit tests were forced to execute after the shared dictionary update: 78 passed, zero failures/errors.
- A live geocoding check for “Harare, Zimbabwe” returned matches. A live public Harare forecast request returned seven days, `Africa/Harare`, Celsius, humidity %, km/h wind, mm precipitation and probability %.
- A browser preview using that live response verified seven forecast entries, the opt-in prompt, offline freshness text, and no page overflow at 390 px. Desktop width was 1280 px. The preview was explicitly labelled as a sample farm and had no AI/cloud account connection. Screenshots: [phone](weather-mobile.png), [desktop](weather-desktop.png).
- Firebase Hosting deployed successfully. The served production JavaScript was checked against the built bundle by SHA-256.
- iOS assets were refreshed with `npm run ios:sync`. The existing compiled simulator shell was refreshed with those assets, installed and launched. A later screenshot after cold startup confirms the Home header now clears the status bar: [iPhone header](weather-ios-header.png). No native AI or signing change was made.

Weather probabilities are provider forecasts, not a measured Munda accuracy score or a guarantee of field conditions. Precipitation totals include liquid-equivalent snow where applicable. This change does not prescribe irrigation, planting or pesticide decisions. New language copy remains draft pending native-speaker review. Android receives the shared dictionary additions; its native weather UI remains the existing implementation.

Sources: [Open-Meteo forecast API](https://open-meteo.com/en/docs), [provider attribution](https://open-meteo.com/).
