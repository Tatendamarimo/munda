# Munda — Devpost submission draft

## Tagline
Farm insights offline. A careful maize check in the field, a broader view when signal returns.

## Inspiration
A yellow maize leaf is an observation, not a diagnosis. Similar signs can have different causes, and a farmer with weak connectivity still needs a useful next step. We built Munda around recording evidence, showing uncertainty, and checking before spending money on inputs.

## What it does
Munda turns a description or optional photo into a structured maize scouting record: possible causes, evidence, missing information, and practical next checks. It asks a few focused questions and saves observations offline. When connected, records sync and a history review compares checks across the farmer's plots. English and six additional language dictionaries are included; translations still need native-speaker review.

## How we built it
The Android app uses Kotlin and Jetpack Compose; the installable web app uses React and TypeScript. Both call Firebase AI Logic at runtime, using hybrid models with `PREFER_ON_DEVICE` and explicit cloud models for fallback and larger work. The SDK's actual inference source determines the result label. Supported devices with the downloaded local model can generate results offline. Devices without it queue observations until online.

Firestore provides persistent records and synchronization. Firebase Authentication supports guests and optional email accounts; linking an account preserves the guest identity. App Check protects AI access, and Remote Config controls model selection and feature settings. A shared maize guide grounds retrieval and possible causes. Parser rules constrain the output rather than relying only on prompting.

## Challenges
Local model availability differs by hardware, and output must fit a small context. We retrieve a compact set of relevant guide entries locally, validate structured answers, and keep an explicit queue path for devices unable to run AI offline. Keeping record ownership during guest-to-email account linking was another key concern.

## Accomplishments
A coherent web and Android experience shares a crop guide, translations, record structure and backend. The web regression suite currently passes 166 tests. These checks cover software behavior; they are not evidence of agronomic accuracy or real-world farmer adoption.

## What we learned
Offline saving, offline inference and cloud synchronization are separate capabilities and need separate demonstrations. An honest explanation of uncertainty is part of the product, not a disclaimer added afterwards.

## What's next
Real-device evaluation, farmer and extension-officer feedback, native-speaker review, and additional crop guides. Livestock needs a separate design with appropriate veterinary referral rules.

## Competition-period work — verify before submission
Use repository history to establish dates and the pre-competition baseline. Recent work includes visual redesign and illustrations, photo-first checks, pending-photo handling, Android parity and groups, guest-first setup, recoverable email accounts, and localized setup copy. Do not claim all of these were completed within the submission period until dates are checked. If an earlier publicly used app existed, describe its prior value and distinguish the new work.

## Submission links and fields
- Live app: https://app-munda.web.app/
- Repository: https://github.com/Tatendamarimo/munda
- License: Apache 2.0
- Platforms: Web/Chrome and Android; confirm Android judge access before selecting both.
- YouTube video: pending recording and public upload; must be at most three minutes and in English or subtitled.
- Real users, adoption, accuracy and outcome figures: not established; do not invent them.
