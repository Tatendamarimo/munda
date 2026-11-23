# ADR 0004: Built for many crops, with livestock later

**Status:** Accepted, 2026-11-23

## Context
Munda launches with maize, but the goal is a farm assistant covering several crops and, later, livestock. The hackathon version must stay focused, but nothing in it should need a rewrite to grow.

## Decision
**Now (in code):**
- Every observation carries a `crop` (`Crop` enum; currently `MAIZE`), stored in Firestore and validated by the security rules.
- Crop knowledge sits behind a `SymptomGuide` interface; `Guides.forCrop()` picks the guide. Prompts, on-device retrieval, output parsing and history rules all go through it. Nothing downstream mentions maize.
- History patterns only compare observations of the same crop.
- `GuidesTest` enforces the contract every guide must meet (unique stable ids, keywords, signs, distinguishing features, field checks).

**Adding a crop (e.g. beans, sorghum, cassava):**
1. Add the enum value and a guide object implementing `SymptomGuide`, with its own context boosts.
2. Add per-crop growth stages if they differ (generalise `CropStage` into a per-crop list at that point).
3. Add the value to the `crop in [...]` list in `firestore.rules`.
4. Add retrieval scenarios to the eval tests.
No changes are needed to the AI pipeline, sync, workers or review.

**Livestock (later, deliberately not modelled yet):**
Livestock differs enough that sharing the crop model would distort both: the subject is an animal or a herd, not a plot; symptoms are behavioural and physical; urgency and referral rules are stricter; and some conditions are legally notifiable. The plan:
- Generalise `Observation` into a subject (`Plot` | `Animal`/`Herd`) with a domain-specific body, keeping the shared envelope (id, org, owner, origin, timestamps, review).
- Add a livestock guide with its own core questions (e.g. how many animals, eating/drinking, how long) in place of area / rainfall / onset.
- Stronger guardrails: a "contact a vet" escalation rule enforced in code for named high-risk signs and notifiable diseases.

## Consequences
- The brand is **Munda** (not tied to one crop or to "doctor"). Package `app.munda` is permanent.
- **Tripwire:** when the second crop ships, revisit whether `CropStage` and `CoreAnswers` should become per-crop data instead of enums; when livestock starts, write a dedicated ADR for the subject model before any code.
