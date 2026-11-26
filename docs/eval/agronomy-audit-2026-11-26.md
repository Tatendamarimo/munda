# Farmer guidance audit — 26 November 2026

## Accuracy status

**Diagnostic accuracy is not yet measured.** No independent, expert-labelled field evaluation or agronomist sign-off was available in this audit. Do not advertise an accuracy percentage. Passing software tests, finding supporting publications, or completing a successful cloud request does not measure diagnostic accuracy.

Scope: source screening of the 22 maize guide entries, farmer-facing guide presentation/read-aloud, translated symptom/check fields and model-output handling in web and Android. This is a desk review, not independent agronomic certification. Initial audit: guide version 3. The version 4 expansion is recorded below.

## Changes made

Fourteen entries were corrected or qualified. Changes address nutrient look-alikes and inappropriate automatic fertilization; over-generalized fall armyworm thresholds and ash/soil advice; blanket residue destruction for termites/stalk borers; storage-pest identification; outdated MLN geography and fixed isolation/maize-free prescriptions; ineffective residue-based rust prevention; ear-rot diversity and grain safety; and common/head smut distinctions.

Mould colour or an apparently normal photograph cannot establish grain safety. Damaged or mouldy grain should be segregated and referred for appropriate assessment; drying does not remove pre-existing mycotoxins. The app must not imply that such grain is safe to sell, eat or feed to animals.

The existing look-alike distinctions were missing from the guide screen and narration. They are now displayed and included in the complete reading on both platforms. Storage-pest and ear-rot translated symptom/check fields were updated alongside English guidance.

Model handling now rejects dose-bearing review actions detected by the existing filter, drops history patterns with no valid record references, uses the canonical guide name for a recognised cause, and routes outside-guide causes to extension advice. Prompts include guide action cautions. These are limited safeguards: numeric dose detection is not a comprehensive multilingual safety classifier, and a valid record reference does not prove a model's interpretation is true. Summaries and proposed checks still require evaluation for hallucination and unsafe advice.

## Coverage and remaining gaps

- Maize only. Other crops and animals are outside this reference's scope.
- Twenty-two entries are not an exhaustive differential. The initial audit lacked herbicide injury, hail/cold damage and root/stalk/seedling disease references; version 4 adds six broad references for these. Iron deficiency, additional pests and disease-specific differentials remain outside the dedicated entries. Healthy plants, mixed problems and unusual presentations also need explicit evaluation. Outside-guide referral is essential.
- Visual symptoms overlap. Soil/tissue testing, pest identification or laboratory/plant-health confirmation may be needed. Labels such as “Likely” are heuristic, not calibrated probabilities.
- Source material includes US and East African contexts. Local crop stage, cultivar, weather, soils and registered treatments matter; Zimbabwe-specific extension review remains pending. Do not carry foreign rates or calendar recommendations directly into local advice.
- All 22 guide-photo records remain agronomically unconfirmed. Licensing/source attribution is separate from diagnostic validation. The acid-soil image cannot establish soil pH; a termite identification image does not demonstrate maize injury; the ear-rot photograph shows one example, not every fungus; the nitrogen image needs symptom confirmation.
- Six translated guide files cover names, signs and field checks, while other agronomic sections remain English. Seven interface languages do not mean seven fully translated and agronomist-reviewed guides. Native-speaker and agricultural review remain pending.
- Existing observations do not persist the exact guide/model version used. Add provenance before a formal longitudinal accuracy study.

## Entry inventory

“Corrected” means this desk audit changed guidance; it does not mean field accuracy has been established. “Screened” entries still require independent local expert review.

| Entry | Desk review | Independent local expert validation |
| --- | --- | --- |
| Nitrogen deficiency (`nitrogen`) | Corrected / qualified | Pending |
| Potassium deficiency (`potassium`) | Screened; no change in this audit | Pending |
| Phosphorus deficiency (`phosphorus`) | Corrected / qualified | Pending |
| Sulfur deficiency (`sulfur`) | Corrected / qualified | Pending |
| Zinc deficiency (`zinc`) | Corrected / qualified | Pending |
| Magnesium deficiency (`magnesium`) | Screened; no change in this audit | Pending |
| Acid soil (`acid_soil`) | Screened; no change in this audit | Pending |
| Waterlogging (`waterlogging`) | Corrected / qualified | Pending |
| Drought / moisture stress (`drought`) | Screened; no change in this audit | Pending |
| Fall armyworm (`fall_armyworm`) | Corrected / qualified | Pending |
| Maize stalk borer (`stalk_borer`) | Corrected / qualified | Pending |
| Cutworm (`cutworm`) | Screened; no change in this audit | Pending |
| Termites (`termites`) | Corrected / qualified | Pending |
| Storage pests (weevil and larger grain borer) (`storage_pests`) | Corrected / qualified | Pending |
| Maize streak virus (`streak_virus`) | Corrected / qualified | Pending |
| Maize lethal necrosis (MLN) (`mln`) | Corrected / qualified | Pending |
| Grey leaf spot (`grey_leaf_spot`) | Screened; no change in this audit | Pending |
| Northern leaf blight (`leaf_blight`) | Screened; no change in this audit | Pending |
| Common rust (`common_rust`) | Corrected / qualified | Pending |
| Ear and cob rots (`ear_rot`) | Corrected / qualified | Pending |
| Smut (common and head smut) (`smut`) | Corrected / qualified | Pending |
| Striga (witchweed) (`striga`) | Screened; no change in this audit | Pending |

## Sources used for corrections

The guide itself contains per-entry source links. These references support particular statements; they do not validate the complete application or establish a field accuracy percentage.

- [UMN Extension: Flooded corn](https://extension.umn.edu/agriculture/crop-production/corn/flooded-corn)
- [Manitoba Agriculture: Corn trouble shooting](https://gov.mb.ca/agriculture/crops/crop-management/grain-corn/corn-trouble-shooting.html)
- [Iowa State Extension: Is it nitrogen or sulfur deficiency?](https://crops.extension.iastate.edu/post/it-nitrogen-or-sulfur-deficiency-symptoms)
- [NC State Extension: Sulfur deficiency symptoms in emerging corn](https://corn.ces.ncsu.edu/sulfur-deficiency-symptoms-in-emerging-corn/)
- [Babendreier et al. (2020): Efficacy of alternative fall armyworm controls](https://pmc.ncbi.nlm.nih.gov/articles/PMC7240539/)
- [Infonet-Biovision: Termites](https://www.infonet-biovision.org/plant_pests/termites)
- [Purdue Extension: Rice, granary and maize weevils](https://extension.entm.purdue.edu/publications/E-237/E-237.html)
- [FAO: Inspection, sampling and analysis of maize for aflatoxin](https://www.fao.org/4/x5036e/x5036E1d.htm)
- [KALRO / KEPHIS / CIMMYT and partners: MLND management poster (2024)](https://mln.cimmyt.org/wp-content/uploads/sites/39/2024/01/English-Version-MLN-Poster-FINAL-4.01.2024.pdf-1.pdf)
- [UMN Extension: Common rust on corn](https://extension.umn.edu/agriculture/crop-production/corn/common-rust-on-corn)
- [UMN Extension: Corn ear rots and mycotoxins](https://extension.umn.edu/agriculture/crop-production/corn/corn-ear-rots-and-mycotoxins)
- [WHO: Mycotoxins](https://www.who.int/news-room/fact-sheets/detail/mycotoxins)
- [UC IPM: Head smut of corn](https://ipm.ucanr.edu/agriculture/corn/head-smut/)

## Evaluation required before an accuracy claim

1. Assemble at least 100 independent real cases as an initial pilot, expanding until each important class and setting has useful coverage. Include healthy, mixed and outside-guide cases, crop stages, farms, lighting, languages and poor-quality photos. This sample target is a planning minimum, not a guarantee of statistical precision.
2. Obtain consent, remove personal details, and have two qualified agronomists label cases independently. Adjudicate disagreements; use laboratory confirmation where necessary and retain uncertainty instead of forcing a diagnosis.
3. Freeze the guide, model, prompts and dataset versions. Hold out entire farms; keep evaluation cases out of development and retrieval examples.
4. Evaluate text, photo and combined inputs separately, with device/offline/cloud and language breakdowns. Record model unavailability and failed outputs as well as successful cases.
5. Report top-1 and top-3 diagnostic performance with denominators and confidence intervals, class-level recall, outside-guide/referral performance, abstention rate and expert-rated action safety. Identify any harmful advice separately. Do not interpret a heuristic likelihood label as a probability.
6. Publish failures and exclusions. An overall average must not hide missed dangerous conditions, unsafe grain advice, weak languages or unavailable offline inference.

The existing authored retrieval examples and software regressions check intended behaviour only. They are not a blinded field benchmark. Genuine on-device inference validation also remains outstanding.

## Software verification

Web: 178 tests passed across 27 files; production build passed. Android: 74 unit tests passed with zero failures/errors; debug Kotlin compilation passed. These results verify software regressions, not agronomic accuracy.

## Version 4 expansion and narration repair

The guide now contains **28 references**, adding:

- **Herbicide injury** (`herbicide_injury`): [UF/IFAS: Diagnosing herbicide injury in corn](https://ask.ifas.ufl.edu/publication/AG374); [Wisconsin Corn Agronomy: Diagnosing injured corn](https://corn.agronomy.wisc.edu/Management/L028.aspx).
- **Hail and wind damage** (`hail_wind_damage`): [University of Minnesota Extension: Wind and hail damage on corn](https://extension.umn.edu/agriculture/crop-production/corn/wind-and-hail-damage).
- **Cold and frost injury** (`cold_frost_injury`): [NC State Extension: Frost or freeze damage to corn](https://craven.ces.ncsu.edu/frost-or-freeze-damage-to-corn/).
- **Seed rot and seedling blight** (`seedling_disease`): [UC IPM: Seed rot and damping-off of corn](https://ipm.ucanr.edu/agriculture/corn/seed-rot-and-damping-off/).
- **Root rot and root injury** (`root_rot`): [Iowa State Extension: Corn field guide, seed and root diseases](https://crops.extension.iastate.edu/files/inline-files/corn-field-guide.pdf); [Iowa State Extension: Scouting tips for seedling disease](https://crops.extension.iastate.edu/post/scouting-tips-seedling-disease).
- **Stalk rot and weak stalks** (`stalk_rot`): [UC IPM: Fusarium stalk rot of corn](https://ipm.ucanr.edu/agriculture/corn/fusarium-stalk-rot/).

These are symptom-comparison references rather than confirmed pathogen diagnoses. They include look-alikes, field checks, crop-stage context, referral and prevention guidance without product doses. The new references use English fallback, visibly disclosed when another interface language is selected. The six photographs were pending at the initial version 4 release and are now supplied; reviewed agronomic translations remain pending. The original 22 credited photos remain available. See `shared/guides/coverage.json`. No unrelated photos or generated diagnostic illustrations were substituted.

Acid-soil text now qualifies pH thresholds and the role of soil/test method, variety and acidifying fertilizers; lime decisions remain based on a locally interpreted soil test.

The response schema explicitly supports NO_CLEAR_PROBLEM, UNCERTAIN and MIXED alongside POSSIBLE_CAUSES. Both parsers permit empty causes only for explicit abstention, discard contradictory causes on abstention, keep mixed causes below HIGH and use fixed uncertainty/referral wording. The persisted record shape is unchanged for backward compatibility. Follow-up prompts may ask about recent spraying/fertilizer/manure when it distinguishes the candidate causes, and include the field context already recorded. Prompt instructions do not guarantee model compliance.

Narration now prefers literal device speech when a suitable voice is available. It sends short passages in order, preserves every cloud audio part rather than keeping only the first, and rejects explicitly truncated/blocked cloud generations. Web progress and a visible failure message distinguish unfinished reading; Android reports a failure rather than silently treating missing speech as success. Cloud speech remains generative, so exact spoken wording and actual device audio need listening checks on target devices.

Verification: **194 web tests passed**, production build passed; **78 Android unit tests passed**, debug compilation passed. A browser regression with a clearly labelled mock speech engine verified all acid-soil text through the final safety note (12 passages), stopping the queue, visible failure and successful retry; all 28 guide links and mobile layout also passed. Mock speech validates control flow and the exact text delivered to the engine, not acoustic output or agronomic accuracy.

Accuracy remains **unmeasured**. No independent field cases or agronomist sign-off have been added by this implementation.

Deployed smoke check: one synthetic normal-looking maize case completed against the real cloud model (`gemini-3.5-flash-lite`, HTTP 200). The result named no disease, displayed the fixed health qualification and monitoring/referral check, and was not saved as a farmer record. The UI reported 39.6 seconds for this request; this is one observation, not a latency benchmark. Evidence: `docs/evidence/2026-11-26/maize-live-abstention-smoke.json`. This does not add an independent field-validation case or establish accuracy.

Photo completion: all six new references now have credited, source-checked photo examples with licence links. All 28 references resolve offline assets. Details and image-subject limitations: [maize-photo-completion-2026-11-26.md](maize-photo-completion-2026-11-26.md). This does not establish diagnostic accuracy or agronomist approval.
