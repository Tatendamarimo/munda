# Android parity with the web app

**Goal:** the Android app does everything the web app does, looks the same (design B), speaks the same 7 languages, and reads and writes the same data, so a farmer can use either and see one farm.

**Why:** the owner's rule: the apps work together and sync everything. Today Android is the older English-only build with 3 screens.

**Source of truth:** the web app. Anything shared is generated or copied from one place, never written twice:

| What | Shared how |
|---|---|
| UI text, 7 languages | `scripts/export-i18n.mjs` writes `android/app/src/main/assets/i18n/<lang>.json` from `web/src/i18n/*.ts` |
| Maize guide + translations | `shared/guides/` copied into assets at build (already done for `maize.json`) |
| Firestore data and rules | unchanged schema; `orgFor` already matches on both |
| AI prompts and schemas | Kotlin mirrors `web/src/ai/prompts.ts` / `schemas.ts`; tests pin the key lines |

## Tasks

1. **Baseline**: build + unit tests green with Android Studio's JDK.
2. **Shared text**: export script + Android `I18n` (lookup, `{var}`, English fallback, language setting) + calendar for sn/nd. Tests port `i18n`/`calendar` web tests.
3. **Shared logic**: farm summary/plots/timeline/alert, AI trail, partial JSON + live preview, weather parse/geocode/fresh rules, prompt updates (language line, againstOrMissing, waterlogging), voice ranking. Tests port the web tests one to one.
4. **Data**: prefs (name, area, extension, planting dates, language, weather), weather fetch with area fallback, sync activity for the banner.
5. **Shell + Home**: design B theme, 4-tab bottom bar, hero with drawn field, place/weather, 3 stats, Check a crop card, alert, timeline, connection banner.
6. **Check-a-crop flow**: describe (photo/speak/type) → plot + stage tiles → area → rain → onset pictures → AI questions → live streamed answer → save.
7. **Record screen**: where-the-AI-worked trail, causes with kernel meter, evidence, check first, review, facts, read-aloud (Gemini voice online, device voice offline).
8. **Plots, plot, guide, Me**: field map, list with trend, plot timeline + planting date, guide list + entries in the farmer's language, Me settings incl. offline AI status.
9. **App Check + device run**: debug token registered for Android, run on the emulator, screenshots of each screen next to the web one.

After parity: settings sync through Firestore and Google sign-in linking so one farmer's phone and browser share a farm.
