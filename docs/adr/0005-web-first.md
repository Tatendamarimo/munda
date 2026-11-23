# ADR 0005: Web (Chrome) as the submitted platform; Android kept as a second client

**Status:** Accepted, 2026-11-23

## Context
The Android client was complete, but the team's test devices are an iPhone 14 Pro and a MacBook. The iPhone 14 Pro has no Apple Intelligence, so no on-device model on iOS. Gemini Nano in Chrome isn't available in mobile browsers. It is available in desktop Chrome on macOS 13+, with text + image input, JSON output, and a ~9k-token limit. An untested client can't be demonstrated, and the demo must show the app working.

## Options
1. **Android only.** Best "phone in the field" story, but no device to test or film on.
2. **iOS.** Not possible on-device with the available iPhone.
3. **Web PWA.** Runs on the MacBook with Gemini Nano offline, and on the iPhone in cloud mode. It's fully buildable and testable in CI (unit tests, emulator-backed end-to-end tests).

## Decision
Option 3. The web client is a port of the Android design with identical Firestore schema and security rules, a shared crop guide (`shared/guides/*.json`, with a parity test on Android), and the same routing, uncertainty and history rules (ported tests).

Platform differences, handled explicitly:
- **Background work:** Android's WorkManager becomes an in-app sync processor that runs while the app is open (Web Locks to avoid duplicate tabs). The queue is Firestore state, so nothing is lost across reloads.
- **Model download:** Chrome requires a user gesture, so the app has an explicit "Download offline AI" button.
- **Dictation:** desktop Chrome's speech recognition needs signal; typing is the offline path.

## Consequences
- The demo uses the MacBook for offline on-device AI (framed as the extension officer's or cooperative's device) and the iPhone for cloud mode, which shows the hybrid SDK's fallback on real hardware.
- **Tripwire:** if a supported Android phone becomes available, the Android client can be tested and submitted as a second platform with no data or rules changes.
