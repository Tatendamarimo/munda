# Munda: judge testing guide

Live web app: https://app-munda.web.app/  
Source: https://github.com/Tatendamarimo/munda  
License: Apache 2.0 (`LICENSE`). No purchase is needed.

## First visit

1. Open the hosted app in Chrome. Choose English, then Continue as guest. First activation needs internet. Email signup is optional.
2. Skip name and area if preferred. These are device settings, not required personal information.
3. Check offline readiness. Only download the local model on a supported device with sufficient storage. Unsupported devices can use cloud AI online and queue observations offline.
4. Open Check a crop. Use a clearly labelled test plot such as `DEMO-MAIZE`, not a real farmer's record.

## Three different proofs

| Test | Procedure | Evidence to capture |
|---|---|---|
| Genuine local inference | Download the model while connected. Wait until ready, then disable the test device's network. Create a maize check. | New model-generated result with actual `On this device` origin while network is unavailable. A cached sample does not count. |
| Cloud fallback | Use an online device/browser without a usable local model. Create another check. | Completed result labelled Cloud AI, with no App Check or quota error. |
| Offline queue and reconnect | On a device without local AI, disconnect after setup, save a check, then reconnect. Keep the app open. | Waiting observation becomes a completed, synced record; inspect history review separately. Saving offline alone is not local inference. |

Suggested input: “Lower leaves are yellowing from the tip down the middle and the plants are not growing well.” Select a matching growth stage; answer the visible area/rain/onset questions truthfully for this synthetic scenario. AI questions and results vary; do not require a predetermined diagnosis.

A history pattern requires earlier records on the same plot. Use the labelled synthetic sequence in `eval/scenarios.md`. Do not present synthetic cases as farmer validation. Rule findings can remain available if the cloud review model fails, so a review card alone does not prove successful cloud model inference. Capture the successful model response or relevant network/log evidence, with tokens redacted.

## Source evidence

- Web: `web/src/ai/mundaAi.ts` constructs `PREFER_ON_DEVICE` / `ONLY_IN_CLOUD` models and calls `generateContent` / `generateContentStream`; records actual SDK `inferenceSource`.
- Android: `android/app/src/main/java/app/munda/data/inference/MundaAi.kt` constructs hybrid/cloud models and calls the SDK at runtime.
- Routing: `web/src/domain/routing.ts`; queue processing: `web/src/sync/syncProcessor.ts`.
- Cloud history: `web/src/ai/reviewer.ts`; deterministic findings remain available on AI failure.
- App Check is initialized before AI services in `web/src/data/firebase.ts`. Android uses debug App Check in debug builds and Play Integrity in release builds.

## Android access

No downloadable judging APK is currently published. Build from `android/` using the README instructions and your Firebase Android configuration. Debug installations require their App Check token registered by the project owner; do not publish debug tokens in documentation or videos. Local AI requires supported physical hardware; an emulator is suitable for cloud/queue tests, not proof of local inference.

## Boundaries

Current crop coverage is maize. Other crops and livestock are roadmap items. Local AI requires a supported device and a predownloaded model; installation alone does not establish compatibility. Dictation availability depends on the device and may require internet. Photos stay out of Firestore but are sent to AI Logic for cloud assessment; pending photos can be stored temporarily on the device. Munda offers possible causes and checks, not a confirmed diagnosis or pesticide prescription.
