# Munda redesign: design B, international, easy for any farmer

**Date:** 2026-11-23 · **Status:** awaiting approval · **Scope:** web app (`web/`), the submitted platform (ADR 0005)

## Intent

Munda is a hackathon entry (hybrid on-device/cloud AI) and a tool real smallholder farmers should be able to adopt anywhere, starting from the story of the owner's grandmother's maize in Hwedza. Two audiences, one app:

- **Farmers:** a farmer with little reading, no signal and a sick plant can photograph it, tap a few pictures and get "check this before buying anything" in their own language.
- **Judges:** it looks like a real, well-funded farm product and makes the hybrid AI story visible (on-device in the field, cloud patterns across the farm's history).

## Goals

1. Rebuild the web UI in **design direction B** (mockup: `.superpowers/brainstorm/*/content/best-b.html`): deep green header with location, weather and greeting; three summary boxes; a yellow "check a crop" card overlapping the header; alert card; plot timeline; 4-tab bottom bar (Home, Plots, Guide, Me).
2. **Picture answers:** the three core questions (area, rain, onset) and crop stage become one-question-per-screen picture tiles with an "I'm not sure" option. Typing is optional.
3. **Result screen** leads with the top possible cause, the kernel meter, fits / doesn't fit, and a prominent **"Check before buying anything"** box, plus "Call extension officer" and "Save".
4. **Plot pages:** a timeline per plot (affected area over time, heavy-rain markers) with the cloud review's pattern tags and numbered next checks.
5. **Guide tab:** browse the 14 maize problems offline, in the chosen language.
6. **Seven languages** behind a switch: English, Shona, Ndebele, Swahili, French, Portuguese, Spanish. English and Shona finished first; others ship marked **beta** until a native speaker checks them. Adding a language = adding one file.
7. **Read-aloud** on every main screen, using the device's speech voices; hidden when the device has no voice for the chosen language.
8. **International basics:** dates and numbers via `Intl` in the chosen locale; extension-officer contact set by the user (name + phone) instead of a fixed number; weather and place from the device's location.

## Non-goals (this round)

- **Android redesign.** It keeps working on the same data; restyling it is a follow-up.
- **Region-specific guide filtering** (e.g. hiding striga outside Africa). Noted for later; the guide stays maize-wide.
- **New crops or livestock.**
- **Firestore schema or security-rule changes.** Everything new is derived from existing observations or stored on the device.
- **Machine translation shipped as checked.** Beta languages are labelled beta.

## Anti-goals (failure even if it works)

- A farmer is told something confidently wrong in their language. Translated advice must come from the human-written guide, not on-the-fly AI translation of advice, and never drop the uncertainty.
- The redesign breaks offline use or the hybrid routing that the demo relies on.
- The prettier home screen hides what Munda actually is: it must stay obvious within seconds that the AI ran on the device or in the cloud.

## Constraints found in the code

- **Domain labels feed the AI prompts.** `models.ts` labels (e.g. `Rainfall.label`) are used in `prompts.ts`. UI translation must be a separate layer; domain labels stay English so prompts and the retrieval tests are unchanged.
- **On-device AI is English-only** here (`expectedInputs/Outputs: ['en']` in `mundaAi.ts`; Gemini Nano supports few languages). So:
  - Model-written free text (summary, evidence lines) stays English on-device.
  - Cause **names** and the **field check** are shown from the translated guide via `guideId`, so the most important parts are in the farmer's language offline. The model's own English text sits under "Details".
  - When the record is made in the cloud and the language isn't English, the prompt asks for the summary and evidence in that language.
- **Retrieval is English keyword matching** (`guide.ts`). Each translated guide file adds keywords in that language, merged into the index, so a Shona description still finds the right entries. The 10-scenario retrieval eval must keep passing.
- **Accents are stripped today.** The index keeps only `a-z`, so "maïs" or "hojas amarillas" would lose letters. Normalise text (NFD, strip combining marks) before matching, in both the text and the keywords. *(Builder's call.)*
- **`shared/guides/maize.json` is shared with Android.** Translations go in new side files (`shared/guides/i18n/maize.<lang>.json`), leaving the original untouched.
- **Firestore rules restrict fields** (`keys().hasOnly`). No new fields on observations; language, region, extension contact and weather cache live in `localStorage`.
- **Weather** needs a network call and location permission. Use Open-Meteo (free, no key), cache the last result on the device, and show nothing (not an error) when unavailable or declined.
- **Crop age ("6 weeks")** has no data today. Shown only if the farmer sets a planting date per plot (stored on the device); otherwise hidden.

## Approaches considered

1. **Restyle and extend the existing React app (chosen).** Keep routing, data, sync and AI code; replace the UI layer (`web/src/ui/`) and styles, and add a small i18n layer. Lowest risk to the offline and hybrid behaviour the demo depends on; reuses the tested domain code.
2. **Rewrite the web app from scratch on a UI kit.** Faster to look polished, but it throws away tested offline, sync and routing behaviour days before submission, and a component kit would fight the custom design.
3. **Add an i18n library (i18next or FormatJS).** Mature, but adds bundle size and setup for about 100 strings. A typed in-house dictionary with `Intl` for dates and numbers covers it; it can be swapped for a library later if strings grow.

The owner approved building direction B, international, with the language set above. The approach (1, with a small in-house i18n layer) is my call as builder.

## Design

### Screens and navigation

| Tab | Route | Content |
|---|---|---|
| Home (Kumba) | `#/` | Header (place, weather, greeting, crop line), summary boxes (plots, needing a check, sync), "Check a crop" card, latest alert from cloud review, recent-plot timeline |
| Plots (Minda) | `#/plots`, `#/plots/:plotKey` | Plot list with status dot and trend; plot page = timeline + pattern tags + next checks + its records |
| Guide (Gwara) | `#/guide`, `#/guide/:id` | The guide's problems by category, translated, offline |
| Me (Ini) | `#/me` | Language, name for the greeting, extension contact, offline-AI status and download, about |

The observe flow (`#/observe`) is full-screen without the tab bar: **photo/describe → plot and stage → area → rain → onset → AI follow-ups (if any) → result**. One question per screen, picture tiles, progress dots, back button, read-aloud. Observation detail stays at `#/o/:id`, restyled. On wide screens (≥960px) the existing sidebar + pane layout stays, restyled to match.

### Derived data (no schema change)

- **Plots:** observations grouped by `plotKey`.
- **Status per plot:** latest observation's urgency, plus review patterns if any.
- **"Needs a check":** plots whose latest urgency is SOON or URGENT.
- **Timeline:** `AffectedArea.extent` per observation over time, with heavy-rain markers from `core.rainfall`.
- **Alert:** the most recent review with a pattern.

### i18n

- `web/src/i18n/`: `Lang` type, one dictionary file per language (typed against English, so missing keys fail type-checking), a `useT()` hook, a language store in `localStorage`, and a `beta` flag per language.
- The default language is picked from `navigator.languages` on first run, falling back to English, and can be changed on Me.
- Enum display labels (area, rain, onset, stage, likelihood, urgency, origin) are translated in the UI layer only.
- **Guide translations:** `shared/guides/i18n/maize.<lang>.json` with `{ id, name, signs, checkInField, keywords[] }` per entry. The UI falls back to English per field when missing.

### Read-aloud

`speechSynthesis` with the chosen language's voice, reading the screen's main text: the question and its options, or the top cause and its check. The button shows only when a matching voice exists.

### Visual system

Design B's tokens (forest/leaf greens, maize gold, paper, rust, rain blue), Bricolage Grotesque for headings and Atkinson Hyperlegible Next for text (both already bundled), lucide icons (already a dependency), tap targets ≥56px for the main actions, and light and dark modes kept. Picture tiles use simple inline SVG drawings (field patches, rain levels, a calendar), not photos.

### Testing

- Existing `npm test` (28 tests, incl. retrieval eval) keeps passing.
- New unit tests:
  - i18n: every language has every key; fallback works.
  - Retrieval: Shona keywords find the expected causes for at least the 10 scenarios phrased in Shona.
  - Derived plot status and timeline.
- Check: `npm run build` and `npm run typecheck` pass. Manual run in Chrome, phone-sized and wide, online and offline.

## Left to the builder

- Exact copy wording in English, and first-draft wording in the other six languages. Shona and the beta languages need native-speaker review before the video.
- Picture-tile drawings.
- Order of work, as long as English and Shona are complete before the beta languages.

## Schedule

Deadline: **Dec 1, 2026, 00:00 GMT+2** (#BuildHybridAI on Devpost), so everything must be submitted by the evening of Nov 30. Judging criteria: technological implementation (hybrid inference), design (complete, coherent product), potential impact, quality of the idea. Required: working app (hosted URL encouraged), public GitHub repo with open-source license, YouTube video ≤3 min in English, English text description.

| Day | Work |
|---|---|
| Nov 24–25 | Visual system, tab shell, Home, observe flow with picture answers, result screen, i18n layer with English |
| Nov 26 | Plots and plot timeline, Guide, Me; Shona strings and guide translation; Shona retrieval keywords + tests |
| Nov 27 | Beta languages, read-aloud, weather; Firestore deploy, App Check, hosting deploy |
| Nov 28 | Full offline/online test on MacBook and iPhone; record the history scenario; fixes |
| Nov 29 | Film and edit the video; README and Devpost description |
| Nov 30 | Buffer; submit |

If time runs short, cut in this order: beta languages, then the Guide tab, then weather. Always keep the B home screen, the picture-answer flow, the result screen, the plot timeline, English and Shona.
