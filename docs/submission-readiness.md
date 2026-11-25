# Submission readiness — 2026-11-25

Requirements baseline: hackathon text supplied by the entrant. Final submission deadline shown there: 2026-12-01 00:00 GMT+2 (end of November 30 in Zimbabwe). Verify the final Devpost form before submitting.

| Requirement / proof | Status | Evidence or remaining action |
|---|---|---|
| Hosted web app | Deployed | https://app-munda.web.app/; deployment index/assets previously verified |
| Public source | Verified public | GitHub API reports PUBLIC on 2026-11-25 |
| Open-source license | Verified detected | Root LICENSE; GitHub detects Apache 2.0 |
| Runtime Firebase AI Logic integration | Source verified | Hybrid/cloud runtime calls in both `MundaAi` implementations |
| Web automated regression | Passed | 166 tests in 23 files, rerun 2026-11-25 |
| Web production build | Passed previously | Actual production build deployed to Hosting |
| Android compilation/unit tests | Passed previously | compileDebugKotlin and 70 domain tests; not physical-device inference proof |
| Genuine offline model inference | Pending captured evidence | New result on compatible real device, network off, actual SDK origin |
| Successful cloud inference | Pending captured evidence | Live flow with working App Check, capture successful model response |
| Queue → reconnect → completion | Pending captured evidence | Unsupported-local device; no mocked model |
| Cloud history model response | Pending captured evidence | Rule-only fallback can also produce a review; distinguish it |
| Android judging APK | Not published | No existing GitHub release; release signing/distribution and App Check access need preparation |
| Real field examples / user feedback | Not established | Obtain consented examples and honest feedback; no invented adoption |
| Description | Draft prepared | `devpost-draft.md`; review competition-period dates and selected platforms |
| Video | Script prepared, recording pending | `demo-script.md`; public YouTube link required |
| Devpost submission | Not submitted | Final form requires entrant details, actual video and platform choices |

Do not claim an iOS native implementation: an iPhone opening the web PWA is Web, not the Apple Foundation Models platform entry. Maize is implemented; other crops/animals are roadmap. Optional four-day quota account is not a submission requirement.

## Live audit findings

On 2026-11-25, guest setup completed on the hosted app. The test Chrome session reported local AI unavailable. A synthetic cloud check failed with HTTP 401: invalid Firebase App Check token. Configuration inspection found reCAPTCHA Enterprise disabled and no site key in the Munda project. Enabled the required API, created a score-based key restricted to `app-munda.web.app` and `app-munda.firebaseapp.com`, and connected the App Check registration and production config. After deploying the repair, actual cloud-generated follow-up questions completed. Streaming report generation then failed with provider HTTP 500 high demand, including the fallback path. The synthetic observation was saved successfully and showed Synced; background record completion is still being checked. Full cloud-report and offline/reconnect evidence remain pending. This was an online recovery test, not proof of offline queue/reconnect.
