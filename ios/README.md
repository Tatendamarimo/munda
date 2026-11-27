# Munda for iPhone and iPad

The iOS app bundles the existing React interface and guide using Capacitor 8. It uses the same Firebase web Auth/Firestore persistence, parsers, translations, account setup, queue and cloud review as the PWA. No separate farmer database or account migration is needed. Native Firebase AI Logic 12.19.3 provides Apple Foundation Models for text-only local inference. This is **not Gemini Nano** and does not substitute for a Nano-specific hackathon demonstration.

## Build

Requirements: Xcode 26.3 or later (Swift 6.2.3+), Node 24+, and an Apple development team for installing on a real phone. The interface targets iOS 15+, but Apple on-device inference needs iOS 26+, an eligible device (such as iPhone 15 Pro / Pro Max), Apple Intelligence enabled and its system model downloaded. The iPhone 14 Pro can use cloud analysis and offline queueing.

1. `cd web && npm ci`
2. Download the Firebase configuration for bundle ID `app.munda.ios` to `ios/App/App/GoogleService-Info.plist` from the existing project. It is ignored by Git, like the Android config. For this workspace it has been downloaded already.
3. `npm run ios:sync` from `web/`. This builds and bundles local assets, then restores the native package dependency after Capacitor generates its package. Use this command rather than bare `cap sync`.
4. Open `ios/App/App.xcodeproj`, choose your development team in Signing & Capabilities, and select a device or simulator. No team or signing certificate is committed.
5. Debug builds use Firebase App Check's debug provider. Register the token printed in Xcode under Firebase App Check → Munda iOS → Manage debug tokens. Keep it private. Production uses App Attest; register that provider and the Apple Team ID in Firebase before distribution. App Check enforcement is not weakened.
6. Build and run. First-time account activation needs internet. After setup, guides and saved records persist offline. iOS native launch does not use a service worker because the app is already bundled.

Unsigned simulator compilation:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/munda-ios-build CODE_SIGNING_ALLOWED=NO build
```

## AI and privacy

- Text-only notes: local status comes from Apple's model availability. Each native request creates a fresh Firebase AI Logic system-only session. Cloud fallback is handled by the existing Munda routing only when online; parsers still validate every answer.
- Photo requests: Apple's on-device model cannot accept images. Connected requests use cloud Gemini; offline photos remain queued. Photos are never discarded to pretend an image was analysed locally.
- Apple manages model downloads. Munda cannot download or enable Apple Intelligence itself. Settings instructions appear in the AI details. Availability refreshes when the app returns to the foreground.
- Location: explicit button only, native permission prompt, approximate area retained using the existing coarse-grid policy. No background location.
- App Check: the WebView uses a custom provider backed by native attestation. No reCAPTCHA workaround or shipped debug token.
- Existing device speech is used where WebKit supports it; typing remains available. Native dictation and native text-to-speech parity need a physical-device check.

## Release status

This is an initial iOS implementation, not an App Store or TestFlight release. Signing, App Attest production registration, physical-device offline inference, camera/location/voice permissions, and live account/sync checks must be completed before release. A simulator build does not prove Apple Intelligence inference. Shared guide text is still awaiting agronomic review and diagnostic accuracy is unmeasured.

References: [Firebase iOS hybrid guide](https://firebase.google.com/docs/ai-logic/hybrid/ios/get-started), [Apple Intelligence requirements](https://support.apple.com/en-us/121115).

## Validation evidence

The initial unsigned simulator compile passed for arm64 and x86_64, using a temporary source-only Firebase release build after remote dependency downloads failed. The normal pinned dependency is restored. All 200 shared tests passed. See [the validation record](../docs/evidence/2026-11-27/ios-validation.md) for the exact build workaround and limits.
