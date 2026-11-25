# Munda demo video — target 2:50, maximum 3:00

Use actual screen recordings and English narration/subtitles. Never use the development demo, fake model, cached example or mocked network as evidence of inference. AI responses vary: narrate the result actually captured. Label synthetic maize scenarios and credit every external photo. No real farmer data without permission.

| Time | Real footage | Narration |
|---|---|---|
| 0:00–0:15 | App and a credited maize image | “A yellow leaf can have several causes. Munda helps a farmer record the evidence and choose what to check next, even where connectivity is poor.” |
| 0:15–0:25 | Supported device, local model ready; disconnect network visibly | “This device has its model downloaded. The internet is now off.” |
| 0:25–1:05 | Create a new synthetic maize check, answer questions, capture full generation | “Firebase AI Logic runs the check locally. Munda weighs the observation against a compact maize guide.” Mark any sped-up section and keep a timer visible. |
| 1:05–1:25 | Actual result with SDK-derived origin, uncertainty and next check | “These are possible causes, with evidence and missing facts. The next step is a field check before buying inputs.” Do not promise a specific cause. |
| 1:25–1:55 | Reconnect; show saved record syncing and history comparison | “With signal, the record syncs through Firestore. A separate cloud review can consider earlier checks.” Show pre-created history labelled synthetic. Claim successful cloud review only if model-response evidence confirms it. |
| 1:55–2:20 | Second platform: actual Android app, preferably cloud mode on unsupported local hardware | “On a device without a local model, Munda uses cloud AI when connected and queues checks when offline.” Show a newly completed Cloud AI result. If Android is not working, show another web device and submit Web only; do not present an iPhone PWA as native iOS. |
| 2:20–2:35 | Switch language; show guide-backed names and checks | “The guide and interface travel with the app. Additional language drafts are included; native-speaker review is next.” |
| 2:35–2:50 | Runtime code briefly, then live URL and repository | “Firebase AI Logic, Firestore, Auth, App Check and Remote Config. Munda: farm insights offline.” |

## Before recording

- Verify the local model on real supported hardware. Download/warm up online before disconnecting.
- Complete one full unedited local run, one cloud run, and one queued-reconnect run. Record results in `submission-readiness.md`; do not substitute unit tests for these.
- Keep demo accounts and plots separate from real records; hide emails, tokens and console credentials.
- Prepare previous observations for history, marked synthetic. Never fabricate dates, outcomes or user feedback.
- Prefer Chrome + Android if both actually work. Single-platform submission remains an option.
- Export at 1080p with readable text, captions and clear sound. Aim for 2:50 including credits.
- Upload publicly to YouTube and test the link signed out. Add it to Devpost and README. No video is published yet.
