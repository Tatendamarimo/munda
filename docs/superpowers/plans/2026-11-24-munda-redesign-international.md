# Munda Redesign (Design B, International) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Munda's web UI in design direction B with picture-based questions, plot timelines, a guide, and seven languages, without touching the AI routing, sync or Firestore schema.

**Architecture:** Keep `web/src/{ai,data,domain,sync}`. Add a small typed i18n layer (`web/src/i18n/`), pure derived-data modules (`domain/farm.ts`, `domain/localize.ts`), device-only prefs and weather (`data/prefs.ts`, `data/weather.ts`), and replace `web/src/ui/` with tabbed screens. Domain labels stay English because prompts use them; translation happens only in the UI and in side-file guide translations.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5, Firebase JS SDK 13 (`firebase/ai`, Firestore), lucide-react, `Intl`, `speechSynthesis`, Open-Meteo HTTP API.

**Spec:** `docs/superpowers/specs/2026-11-23-munda-redesign-international-design.md`
**Visual reference:** `.superpowers/brainstorm/26211-1795470376/content/best-b.html` (screens 1–4)

## Global Constraints

- Node 24 (`web/.nvmrc`); run commands from `web/` after `source ~/.nvm/nvm.sh && nvm use 24`.
- No changes to Firestore schema or `firebase/firestore.rules`. No new fields on observations.
- `shared/guides/maize.json` is not edited (shared with Android). Translations live in `shared/guides/i18n/maize.<lang>.json`.
- Domain labels in `src/domain/models.ts` stay English; prompts keep using them.
- Languages: `en`, `sn`, `nd`, `sw`, `fr`, `pt`, `es`. `en` and `sn` are complete; `nd`, `sw`, `fr`, `pt`, `es` have `beta: true`.
- On-device model options in `mundaAi.ts` stay `languages: ['en']`.
- Language, name, extension contact, planting dates and weather cache live in `localStorage` only.
- Design tokens (from the mockup): forest `#0c3b24`, leaf `#14633a`, leaf-2 `#1f7a4a`, sprout `#cfe9d6`, wash `#eaf3ec`, maize `#f2b705`, maize-deep `#b98900`, husk `#fff4d1`, paper `#f7f5ee`, ink `#12201a`, ink-2 `#4b5a51`, rule `#e3e1d6`, rain `#2d6a9a`, rain-wash `#e2edf6`, rust `#c2410c`, rust-wash `#fde8dc`. Keep a dark-mode variant.
- Fonts: Bricolage Grotesque (display), Atkinson Hyperlegible Next (text), both already bundled. Icons: lucide-react.
- Main action tap targets ≥ 56px high.
- The origin badge ("On this device" / "Cloud AI" / "Waiting for signal") stays visible on questions, results and records.
- Commit messages: plain, no AI attribution trailers.
- `npm test`, `npm run typecheck` and `npm run build` pass at the end of every task.

## Review Focus

1. **Missing translation** (a key or guide field absent in a language): show the English text, never blank or `undefined`. Tests in Task 1 and Task 2.
2. **Location declined, offline, or weather API down:** the header shows place/weather only when known; no error text, no spinner stuck. Test in Task 4.
3. **Same plot typed differently** ("River plot", " river plot"): grouped as one plot via `plotKey`, shown with the most recent spelling. Test in Task 3.
4. **No observations yet:** Home shows 0 plots, no alert, no timeline, and the "Check a crop" card; Plots shows an empty state. Test in Task 3.
5. **Cause the model invented (`guideId: null`) or language with no speech voice (Shona):** the cause shows the model's own name and check; the read-aloud button is hidden. Tests in Task 7 and Task 10.

---

### Task 0: Baseline repository

**Files:**
- Modify: `.gitignore` (already has `.superpowers/`)

- [ ] **Step 1:** In `~/Downloads/munda`, run `git init -b main`, then `git add -A && git commit -m "chore: import Munda as downloaded"`.
- [ ] **Step 2:** Verify the baseline: `cd web && npm test && npm run typecheck`. Expected: 28 tests pass, no type errors.

---

### Task 1: i18n core (English + Shona)

**Files:**
- Create: `web/src/i18n/langs.ts`, `web/src/i18n/en.ts`, `web/src/i18n/sn.ts`, `web/src/i18n/index.ts`
- Test: `web/test/i18n.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = 'en' | 'sn' | 'nd' | 'sw' | 'fr' | 'pt' | 'es'`
  - `LANGS: Record<Lang, { native: string; english: string; beta: boolean; locale: string }>` (locale e.g. `sn-ZW`, `pt-MZ`, `es-MX`, `fr-FR`, `sw-KE`, `nd-ZW`, `en`)
  - `en` (a nested `as const` object of strings; `{name}` placeholders) and `type Messages = DeepStringify<typeof en>`; each other language file is `Partial<Messages>` deep, so missing keys fall back.
  - `language: Store<Lang>` (persisted under `munda.lang`), `setLanguage(l: Lang): void`
  - `pickInitialLang(navLangs: readonly string[]): Lang`
  - `translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string` where `MessageKey` is the dotted path union of `en`
  - `useT(): (key: MessageKey, vars?) => string` and `useLang(): Lang`
  - `formatDate(ms: number, lang: Lang): string`, `relativeTime(ms: number, now: number, lang: Lang): string` (via `Intl.RelativeTimeFormat` with `LANGS[lang].locale`, fallback `en` if the runtime lacks the locale)
  - Enum label helpers: `labelArea(a: AffectedArea, lang)`, `labelRain`, `labelOnset`, `labelStage`, `labelLikelihood`, `labelUrgency`, `labelOrigin`, `labelPattern` — all backed by `en.enums.*` keys.

The `en` dictionary holds every user-visible string from the new screens (tabs, home, observe steps, result, plots, guide, me, status/AI states, errors, enums). Port existing copy from the current `ui/*.tsx` where it still applies. Shona (`sn.ts`) is a full draft; mark the file header "Draft: needs native-speaker review".

- [ ] **Step 1: Write failing tests** in `test/i18n.test.ts`:
  - `pickInitialLang(['sn-ZW','en'])` → `'sn'`; `(['pt-BR'])` → `'pt'`; `(['de-DE'])` → `'en'`; `([])` → `'en'`.
  - `translate('sn', 'tabs.home')` → `'Kumba'`; `translate('fr', 'tabs.home')` (key absent in fr) → equals `translate('en', 'tabs.home')`.
  - `translate('en', 'home.greeting', { name: 'Gogo' })` contains `'Gogo'`.
  - Every leaf key in `en` is present and non-empty in `sn` (walk both objects).
  - `relativeTime(now - 90_000, now, 'en')` matches `/2 min/`.
- [ ] **Step 2:** Run `npx vitest run test/i18n.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the four files to the interfaces above.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(i18n): typed dictionaries with English and Shona`.

---

### Task 2: Guide translations and multilingual retrieval

**Files:**
- Create: `shared/guides/i18n/maize.sn.json`
- Create: `web/src/domain/localize.ts`
- Modify: `web/src/domain/guide.ts` (KeywordIndex normalisation; merge translated keywords)
- Test: `web/test/guide-i18n.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 1), `GuideEntry`, `guideFor`.
- Produces:
  - Translation file shape: `{ "lang": "sn", "entries": [{ "id": string, "name"?: string, "signs"?: string, "checkInField"?: string, "keywords"?: string[] }] }`
  - `normalizeText(s: string): string`: lower-case, NFD, strip combining marks, keep `[a-z0-9 -]`. Used by `KeywordIndex` for both keywords and input.
  - `KeywordIndex` constructor accepts `extraKeywords: Map<string, string[]>` (entry id → keywords), merged with the English keywords.
  - `localizedEntry(entry: GuideEntry, lang: Lang): { name: string; signs: string; checkInField: string }`: per-field fallback to English.
  - The maize guide loads every `shared/guides/i18n/maize.*.json` via `import.meta.glob(..., { eager: true })` and merges all keywords into one index (a description in any language matches).

- [ ] **Step 1: Write failing tests:**
  - Shona: `maize.relevant('mashizha ari pasi ari kuita yellow uye miti midiki', core('PATCHES','HEAVY'), 'EARLY_GROWTH', 5)` contains `nitrogen`. Add at least 5 Shona phrasings of scenarios 1, 3, 4, 6 and 9 with their `must` ids. Wording comes from the `sn` keywords you write.
  - Accents: `normalizeText('Hojas AMARILLAS y maïs')` → `'hojas amarillas y mais'`.
  - `localizedEntry(maize.get('nitrogen')!, 'sn').name` ≠ English name; `localizedEntry(entry, 'fr')` (no fr file yet) equals the English fields.
  - The existing 10 English retrieval scenarios still pass (unchanged test file).
- [ ] **Step 2:** Run `npx vitest run test/guide-i18n.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write `maize.sn.json` for all 14 entries (name, signs, checkInField, 5–15 Shona keywords each), then implement the changes.
- [ ] **Step 4:** Run `npm test`. Expected: all pass, including `test/domain.test.ts`.
- [ ] **Step 5:** Commit: `feat(guide): Shona guide translation and accent-safe multilingual retrieval`.

---

### Task 3: Derived farm data

**Files:**
- Create: `web/src/domain/farm.ts`
- Test: `web/test/farm.test.ts`

**Interfaces:**
- Consumes: `Observation`, `AffectedArea.extent`, `Rainfall.isHeavy`, `Pattern`.
- Produces:
  - `type PlotStatus = 'OK' | 'WATCH' | 'ACT'` (latest urgency ROUTINE or none → OK; SOON → WATCH; URGENT → ACT; any WORSENING or SPREADING pattern on the latest review raises OK→WATCH).
  - `interface PlotSummary { key: string; name: string; status: PlotStatus; lastAt: number; count: number; latest: Observation }`
  - `plotsFrom(observations: Observation[]): PlotSummary[]`, sorted by `lastAt` descending; `name` is the `plot` of the newest observation.
  - `interface TimelinePoint { at: number; extent: number; heavyRain: boolean; id: string }`
  - `timeline(observations: Observation[], plotKey: string): TimelinePoint[]`, oldest first.
  - `farmSummary(plots: PlotSummary[]): { plots: number; needsCheck: number }`, where needsCheck = WATCH + ACT.
  - `latestAlert(observations: Observation[]): { observation: Observation; pattern: Pattern } | null`: newest observation whose `review.patterns` is non-empty; first pattern.

- [ ] **Step 1: Write failing tests** with a local `obs(partial)` factory:
  - "River plot" and " river plot" observations → one `PlotSummary` with `count: 2` and the newer spelling (uses `plotKey`).
  - Status: SOON → WATCH; URGENT → ACT; ROUTINE + WORSENING pattern → WATCH; no record → OK.
  - `plotsFrom([])` → `[]`; `farmSummary([])` → `{ plots: 0, needsCheck: 0 }`; `latestAlert([])` → `null`.
  - `timeline` orders by time and marks `heavyRain` for HEAVY and FLOODING.
- [ ] **Step 2:** Run `npx vitest run test/farm.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `farm.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): plot summaries, timeline and alerts from existing records`.

---

### Task 4: Device prefs and weather

**Files:**
- Create: `web/src/data/prefs.ts`, `web/src/data/weather.ts`
- Test: `web/test/weather.test.ts`

**Interfaces:**
- Produces:
  - `prefs: Store<Prefs>` with `interface Prefs { name: string; place: string; extension: { name: string; phone: string } | null; plantedAt: Record<string, number> }` (plantedAt keyed by plotKey), and `updatePrefs(patch: Partial<Prefs>): void`. Persisted under `munda.prefs`; corrupt JSON → defaults.
  - `cropWeeks(plantedAt: number | undefined, now: number): number | null`
  - `interface Weather { tempC: number; rainSoon: boolean; rainDay: number | null /* 0=Sun..6 */; place: string | null; at: number }`
  - `parseOpenMeteo(json: unknown, now: number): Omit<Weather, 'place'> | null`: reads `current.temperature_2m` and `daily.precipitation_sum` / `daily.time`; rainSoon when any of the next 3 days ≥ 5 mm; rainDay is the first such day. Returns null on any missing field.
  - `weather: Store<Weather | null>`, `refreshWeather(): Promise<void>`: only when online and the farmer tapped "use my location" on Me (stored flag `munda.weatherOn`); `navigator.geolocation` → `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m&daily=precipitation_sum&forecast_days=4&timezone=auto`; cache in `munda.weather`; reuse the cache if < 3 h old; swallow all errors (keep the last cache). Place name stays `null` (no reverse geocoding); the header shows `prefs.place` when the farmer typed one on Me.

- [ ] **Step 1: Write failing tests:** `parseOpenMeteo` with a valid sample → `tempC` and `rainSoon` correct; missing `current` → `null`; `null` input → `null`; `cropWeeks(undefined, now)` → `null`; 43 days → `6`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): device prefs and cached Open-Meteo weather`.

---

### Task 5: Visual system, routes and tabbed shell

**Files:**
- Rewrite: `web/src/ui/styles.css` (B tokens, typography, cards, header, tab bar, picture tiles, kernel meter, dark mode)
- Modify: `web/src/ui/router.ts`
- Rewrite: `web/src/ui/Shell.tsx` (tab bar on narrow; sidebar + pane on ≥960px; Welcome restyled in `Welcome.tsx`)
- Create: `web/src/ui/TabBar.tsx`, `web/src/ui/Header.tsx` (shared green header: place, weather, greeting slot, offline/AI status pill, language quick switch)
- Test: `web/test/router.test.ts`

**Interfaces:**
- Produces:
  - `type Route = { name: 'home' } | { name: 'plots' } | { name: 'plot'; key: string } | { name: 'guide' } | { name: 'guideEntry'; id: string } | { name: 'me' } | { name: 'observe' } | { name: 'record'; id: string }`
  - `parseRoute(hash: string): Route` (unknown → home); `href(r: Route): string`; `useRoute(): Route`; `navigate(r: Route)`; `back()`.
  - `useObservations(): ObservationItem[] | null` moved to `web/src/ui/useObservations.ts` for reuse.
- Status pill reuses the existing `StatusMenu` behaviour (download offline AI button, progress), restyled and translated.

- [ ] **Step 1: Write failing tests:** `parseRoute('#/plots/RIVER-PLOT')` → `{ name: 'plot', key: 'RIVER-PLOT' }`; `parseRoute('#/o/abc')` → record; `parseRoute('#/nope')` → home; `href(parseRoute(x)) === x` for each valid route.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the router, then the shell, tab bar, header and styles. Tabs: Home, Plots, Guide, Me, labelled via `useT()`. Placeholder bodies for screens not built yet.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run build`. Expected: PASS. Then run `npm run dev`, open at 390×844 and 1280×800, and confirm the tab bar, header and wide layout render in en and sn.
- [ ] **Step 5:** Commit: `feat(ui): design B visual system and tabbed shell`.

---

### Task 6: Home screen

**Files:**
- Create: `web/src/ui/HomePage.tsx`, `web/src/ui/TimelineBars.tsx`

**Interfaces:**
- Consumes: `plotsFrom`, `farmSummary`, `latestAlert`, `timeline` (Task 3); `prefs`, `weather`, `cropWeeks` (Task 4); `Header` (Task 5); `useT`.
- Produces: `TimelineBars({ points: TimelinePoint[] })`, reused by the plot page. Bar height = `extent / 3`; colour sprout for extent ≤1, maize for 2, `#f08a24` for 3; heavy-rain points get a rain-blue tick above the bar.

Layout per mockup screen 1:
- Header with greeting `home.greeting` (with `{name}`, or `home.greetingNoName`), crop line (crop, weeks if known, stage of the latest record).
- Three summary boxes: plots, needs a check, synced/saved-on-device.
- Yellow "Check a crop" card → `navigate({ name: 'observe' })`.
- Alert card from `latestAlert`, linking to the record.
- Timeline of the most recently active plot, with "See all" → plots.
- Empty state: no alert or timeline; a one-line hint under the card.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Verify: `npm run typecheck && npm run build` pass. In the dev server at 390×844, confirm the home screen with zero records, then with records (Task 8 makes records easy to add; until then check with the emulators via `npm run e2e:emulators` or the live project).
- [ ] **Step 3:** Commit: `feat(ui): home screen`.

---

### Task 7: Observe flow with picture answers

**Files:**
- Rewrite: `web/src/ui/ObservePage.tsx` (keep all AI, routing, save and dictation logic; replace the layout)
- Create: `web/src/ui/observe/steps.ts`, `web/src/ui/observe/PictureChoice.tsx`, `web/src/ui/observe/pictures.tsx` (inline SVG drawings for each AffectedArea, Rainfall, Onset and CropStage value, plus "not sure")
- Modify: `web/src/domain/localize.ts` (add `causeDisplay`, see below)
- Test: `web/test/steps.test.ts`, extend `web/test/guide-i18n.test.ts`

**Interfaces:**
- Produces:
  - `type ObserveStep = 'describe' | 'plot' | 'area' | 'rain' | 'onset' | 'followups' | 'result'`
  - `stepsFor(hasFollowUps: boolean): ObserveStep[]` → with follow-ups: all seven in order; without: no `'followups'`.
  - `nextStep(cur, hasFollowUps)`, `prevStep(cur, hasFollowUps)` (null at the ends).
  - `PictureChoice<T extends string>({ question, options, selected, picture: (t: T) => ReactNode, label: (t: T) => string, onSelect })`: 2-column tiles ≥120px tall, selected ring + check, "not sure" as a text link when `options` includes `'UNKNOWN'`.
  - `causeDisplay(cause: PossibleCause, lang: Lang, guide: SymptomGuide): { name: string; check: string; modelCheck: string | null }`: guide-backed causes use `localizedEntry` name and `checkInField` (with `modelCheck = cause.checkNext` when `lang !== 'en'`, else the model text is the check and `modelCheck` null); `guideId: null` → the model's own name and check.
- Describe step: big photo button (camera capture), Speak, Type, text area; Continue needs a description **or** a photo. Plot step: plot name with chips of existing plots (from `plotsFrom`) + crop stage tiles. Selecting a tile on area/rain/onset advances automatically after 250 ms. The follow-ups step shows the AI questions as large text tiles with the origin badge. Questions are fetched when leaving `onset` (same request logic as today).
- Progress dots, back, and the read-aloud slot (filled in Task 10) in the step header.

- [ ] **Step 1: Write failing tests:** `stepsFor(false)` excludes `followups`; `nextStep('onset', false)` → `'result'`; `prevStep('describe', true)` → `null`; `causeDisplay` for `nitrogen` in `sn` returns the Shona name and a non-null `modelCheck`; for `guideId: null` it returns the model name and check in any language.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build` PASS. In the dev server, complete a full observation in en and sn with taps only (plus a photo), online and offline.
- [ ] **Step 5:** Commit: `feat(ui): picture-answer observation flow`.

---

### Task 8: Result screen and record page

**Files:**
- Create: `web/src/ui/CauseCard.tsx` (replaces `CauseEntry`), `web/src/ui/CheckFirst.tsx`
- Modify: `web/src/ui/ObservePage.tsx` (result step), `web/src/ui/DetailPage.tsx` → rename to `RecordPage.tsx`, `web/src/ui/components.tsx` (translated badges, KernelMeter kept)

**Interfaces:**
- Consumes: `causeDisplay` (Task 7), `prefs.extension` (Task 4).
- Per mockup screen 3:
  - Title "possible causes, not a diagnosis".
  - Top cause as a full card: name, likelihood pill, kernel meter, fits ✓ / doesn't fit ✗.
  - `CheckFirst` dark box "Check before buying anything" with `causeDisplay.check`.
  - Other causes as compact rows that expand.
  - Model free text (summary, uncertainty note, and `modelCheck`) under a collapsible "Details" with the origin badge and latency.
  - Buttons: "Call extension officer" (`tel:` link when `prefs.extension` is set, else navigate to Me with a hint) and "Save".
- Record page: same card layout plus the existing history review section, restyled, with pattern tags as coloured pills (WORSENING rust, WEATHER_LINKED rain, RECURRING maize, SPREADING rust, OTHER neutral) and numbered next checks.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build` PASS. Manual check: a result in sn shows Shona cause names and checks, English details collapsed; the record page shows the review after sync.
- [ ] **Step 3:** Commit: `feat(ui): result screen with check-before-buying and restyled record page`.

---

### Task 9: Cloud AI answers in the farmer's language

**Files:**
- Modify: `web/src/ai/prompts.ts`, `web/src/ai/mundaAi.ts`, `web/src/ai/reviewer.ts`, `web/src/sync/syncProcessor.ts`
- Test: `web/test/prompts.test.ts`

**Interfaces:**
- `recordPrompt(i, candidates, outputLang?: Lang)`, `questionsPrompt(i, candidates, outputLang?: Lang)`, `reviewPrompt(..., outputLang?: Lang)`: when `outputLang` is set and not `'en'`, append the line `Write all text values in ${LANGS[outputLang].english}. Keep JSON keys, ids and enum values in English.`
- `mundaAi.followUpQuestions` and `buildRecord` pass `outputLang` only when `route === 'CLOUD'`; on-device prompts are unchanged. The reviewer and sync processor pass the current language (they always run in the cloud).
- Questions from the cloud then come back in the farmer's language; on-device questions stay English (shown with the origin badge).

- [ ] **Step 1: Write failing tests:** `recordPrompt(input, cands, 'sn')` contains `'Write all text values in Shona'`; `recordPrompt(input, cands)` and `recordPrompt(input, cands, 'en')` do not contain `'Write all text values'`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` PASS (parser tests unchanged).
- [ ] **Step 5:** Commit: `feat(ai): cloud answers in the farmer's language`.

---

### Task 10: Plots, Guide, Me and read-aloud

**Files:**
- Create: `web/src/ui/PlotsPage.tsx`, `web/src/ui/PlotPage.tsx`, `web/src/ui/GuidePage.tsx`, `web/src/ui/GuideEntryPage.tsx`, `web/src/ui/MePage.tsx`, `web/src/ui/speech.ts`, `web/src/ui/ReadAloud.tsx`
- Test: `web/test/speech.test.ts`

**Interfaces:**
- `voiceFor(lang: Lang, voices: Pick<SpeechSynthesisVoice, 'lang' | 'name'>[]): Pick<SpeechSynthesisVoice,'lang'|'name'> | null`: exact `locale` match first, then a primary-subtag match (`sn` matches `sn-*`); none → null.
- `ReadAloud({ text: string })`: renders nothing when `speechSynthesis` is missing or `voiceFor` is null; a toggle that speaks or stops. Placed in the observe step header (question + options), the result (top cause + check), and the guide entry.
- **PlotsPage:** list of `PlotSummary` with status dot, last date and mini trend; empty state.
- **PlotPage** (mockup screen 4): `TimelineBars`, pattern pills and next checks from the latest review, planting-date setter (`prefs.plantedAt`), and the plot's records.
- **GuidePage:** entries grouped by category, localized names. **GuideEntryPage:** signs and check in the field, localized, with read-aloud.
- **MePage:** language list (native name, "beta" tag), name, place, use-my-location toggle (weather), extension officer name and phone, offline AI status and download (reuse the status logic), about/version.

- [ ] **Step 1: Write failing tests:** `voiceFor('sn', [{lang:'en-US',name:'a'}])` → `null`; `voiceFor('pt', [{lang:'pt-BR',name:'b'}])` → that voice; `voiceFor('es', [{lang:'es-MX',name:'c'},{lang:'es-ES',name:'d'}])` → `es-MX` (matches `LANGS.es.locale`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build` PASS. Manual: every tab works in en and sn at 390×844 and 1280×800; read-aloud speaks in en and is hidden in sn (unless the Mac has a Shona voice).
- [ ] **Step 5:** Commit: `feat(ui): plots, guide, settings and read-aloud`.

---

### Task 11: Beta languages

**Files:**
- Create: `web/src/i18n/{nd,sw,fr,pt,es}.ts`, `shared/guides/i18n/maize.{nd,sw,fr,pt,es}.json`
- Modify: `web/test/i18n.test.ts`, `web/test/guide-i18n.test.ts`

- [ ] **Step 1: Extend tests:** every language has every `en` key, non-empty. Every guide file has all 14 ids with a name and checkInField. One retrieval scenario per language finds `nitrogen` from a phrasing of scenario 1 in that language (French and Spanish phrasings include accented words).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the five dictionaries and five guide files. Each file header says "Beta: machine-drafted, needs native-speaker review". `LANGS[x].beta = true` drives the "beta" tag on Me.
- [ ] **Step 4:** `npm test && npm run build` PASS.
- [ ] **Step 5:** Commit: `feat(i18n): Ndebele, Swahili, French, Portuguese and Spanish (beta)`.

---

### Task 12: Verify, deploy, document

**Files:**
- Modify: `README.md` (new screenshots section, languages, what was built during the hackathon), `docs/demo-script.md` (shots for the new screens and a language switch)

- [ ] **Step 1:** Run `npm test && npm run typecheck && npm run build`. Expected: all pass. Run `npm run e2e` against the emulators if `e2e/smoke.mjs` still matches the UI; update its selectors if not.
- [ ] **Step 2:** Manual pass in Chrome on the MacBook: Wi-Fi off (on-device), Wi-Fi on (sync + review), language switch en → sn → fr, phone size and wide.
- [ ] **Step 3:** With the owner's go-ahead and after `firebase login`: `firebase deploy --only firestore`, then `cd web && npm run build && cd .. && firebase deploy --only hosting`. Register App Check reCAPTCHA domains for the hosted URL.
- [ ] **Step 4:** Update the README and demo script, then commit: `docs: redesign, languages and demo script`.
