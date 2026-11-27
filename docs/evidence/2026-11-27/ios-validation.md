# Initial iOS validation — 27 November 2026

- Shared web tests: **200 passed**, across 29 files. Includes iOS text-only local inference policy and photo route disclosure (online photos → cloud; offline photos → queue even when local text AI is available).
- Swift syntax check: passed.
- Xcode simulator compile: **BUILD SUCCEEDED**, Debug, arm64 and x86_64, signing disabled. Xcode 26.3 / Swift 6.2.4 / iOS Simulator SDK 26.2.
- Firebase iOS app registered in the existing `app-munda` project with bundle ID `app.munda.ios`. Per-project configuration is local and ignored, consistent with Android.

## Build environment limitation

The ordinary remote Swift package resolution failed: Firebase's full-history Git clone reset, and Google-hosted binary dependencies for unrelated SDK products timed out. To validate our source, the official Firebase 12.19.3 tag archive was downloaded from `https://codeload.github.com/firebase/firebase-ios-sdk/tar.gz/refs/tags/12.19.3` (SHA-256 `1e7012682194f995824f8f2ad48515031df39758357f2fe5e46f59740bdabbbb`). A temporary source-only manifest retained FirebaseAILogic, FirebaseAppCheck, FirebaseCore and their required internal source targets and original settings, excluding unused Analytics / Firestore binaries. Firebase library source files were not changed. Capacitor and other selected dependencies used their ordinary pinned packages.

The temporary local package override was restored after compilation. The committed project retains the normal official Firebase 12.19.3 remote dependency; it contains no temporary SDK source or local absolute package path. An ordinary clean remote-dependency build still needs a reliable connection.

## Simulator launch

Munda installed and launched in the iPhone 17 Pro simulator (iOS 26.3). The onboarding interface rendered. The initial render was delayed; the first capture was blank and a later capture showed onboarding. The first rendered capture exposed status-bar overlap. The final capture verifies the safe-area CSS correction and visible language choices / Continue button. Native Auth now uses explicit persistent app-local storage without an OAuth redirect resolver; language selection is independent of the initial account check. A private simulator App Check debug token was registered without disabling enforcement. This establishes launch, not a completed end-to-end farmer workflow.

## Not verified by this build

Apple Intelligence inference on physical hardware, model output quality, production App Attest attestation and cloud inference, real-device authentication/sync, camera/location/voice permissions, Apple signing, TestFlight and App Store distribution. A simulator compile does not establish offline AI support or hackathon Nano compliance. iOS uses Apple Foundation Models, not Gemini Nano.

Final interface capture: [iOS onboarding](ios-onboarding.png). Native code compiled successfully twice; the final CSS and Auth initialization changes were typechecked, production-built, bundled into the compiled simulator shell, installed and launched. Account activation and downstream workflows remain to be exercised end to end.

The simulator debug-token exchange with Firebase App Check succeeded using the registered iOS app identity. No token value is included in this evidence or committed configuration. Production App Attest remains unconfigured until an Apple development team is selected.
