# ADR 0006: Ship Web and Android as two clients of one backend

**Status:** Accepted, 2026-11-23. Extends [ADR 0005](0005-web-first.md).

## Context
The hackathon gives strong Grand Prize consideration to apps that run on more than one platform. Munda already had an Android client with the same data model, but its design had fallen behind the web client.

## Options
1. **Web only.** Lowest risk, but gives up the multi-platform consideration.
2. **A cross-platform framework (Flutter, React Native, KMP UI).** One UI codebase, but Firebase AI Logic's hybrid on-device inference is platform-specific (Chrome's Prompt API on web, the `firebase-ai-ondevice` library on Android), and a rewrite five days from the deadline is the wrong risk.
3. **Two native clients that share everything below the UI.** The Firestore schema and rules, the crop guide, the routing policy, and the uncertainty and history rules are shared or ported with tests.

## Decision
Option 3. What's shared, and how drift is caught:

| Shared | How |
|---|---|
| Crop guide | One file, `shared/guides/maize.json`. The web imports it; Android's `SharedGuideParityTest` fails if `MaizeGuide.kt` differs. |
| Firestore schema and rules | One `firebase/firestore.rules`, covered by emulator tests. Both clients write the same documents. |
| Routing, parsing, history rules | Ported, with matching unit tests (web: vitest; Android: JUnit). |
| Design | Same palette, type (Bricolage Grotesque, Atkinson Hyperlegible Next), kernel meter and copy. |

Platform differences:
- **On-device model:** Gemini Nano in desktop Chrome, and Gemini Nano through Android's on-device runtime on supported phones. Elsewhere both clients fall back to cloud Gemini and say so before the farmer taps.
- **Background work:** WorkManager on Android; an in-app sync processor on the web.
- **Input limit:** Remote Config `max_on_device_chars` defaults differ (web 6,000, Android 3,000), matching each model's context.

## Consequences
- A record made on a phone can be opened on the web dashboard, and the reverse, because both read the same Firestore documents.
- The Android emulator has no on-device model, so it shows the cloud path. On-device Android needs a supported physical phone.
- **Tripwire:** if a third client is added, move the ported rules into a shared module (Kotlin Multiplatform or a JSON rule spec) instead of porting a third time.
