# Demo video script: MacBook + iPhone (under 3 minutes)

Film indoors near a window. Screen-record the MacBook (QuickTime: File → New Screen Recording) and the iPhone (Control Centre → Screen Recording), and add a few hand-held shots of both devices so viewers see real hardware. English voice-over or subtitles are required.

**Photos:** use real photos a farmer sent you (with permission). If you use dataset images, say so on screen and credit them (see `docs/eval/test-images.md`).

| Time | Shot | Say / show |
|---|---|---|
| 0:00–0:15 | Farmer's photos of their maize (or credited open-licensed field photos), with a "no signal" icon | "Smallholder maize farmers lose harvests to problems spotted too late, often where there's no signal. This is Munda." |
| 0:15–0:30 | Hand-held: MacBook, turn **Wi-Fi off** in the menu bar. The dark banner drops in: **No signal. Munda keeps working on this device.** | "Wi-Fi is off. On this laptop, Gemini Nano runs inside Chrome through Firebase AI Logic. Think of the extension officer's or the cooperative's computer." |
| 0:30–0:55 | Type: "The lower leaves are going yellow from the tip and the plants are small." Add the farmer's leaf photo. Banner: *On this device · private, works without signal* | "I describe what I see and add the photo the farmer took in her field." |
| 0:55–1:20 | Tap **Patches**, **Heavy rain**, **This week**. AI question appears with **On this device**. Answer "Bottom". | "Munda asks what an agronomist would ask first, then picks a question that tells the possible causes apart." |
| 1:20–1:35 | **Working it out** screen: the green *On this device* pill with its seconds counter, the guide entries it weighs, the summary being written, causes lighting up with their kernels. Speed this up 4–6× in the edit and keep the counter visible | "Everything you see is Gemini Nano writing on this laptop, live. No server involved." |
| 1:35–1:50 | Result: **Likely** Nitrogen deficiency, **Possible** Waterlogging, with fits / doesn't fit / check next, the uncertainty note, latency, and the **On this device** badge | "It doesn't diagnose. It shows possible causes, how sure it is, what's missing, and what to check. Those rules are enforced in code, not just requested." |
| 1:50–2:00 | Save. The record opens with **Where Munda's AI worked**: *Saved on this device* and *Causes found on this device* green, *Syncs when there's signal* and *History review* dashed | "Saved offline. Two steps done on the device; two waiting for the cloud." |
| 2:00–2:25 | Turn **Wi-Fi on**. Blue banner: *Back online. Syncing and reviewing in the cloud…*. The trail fills in blue (**Synced**, **History review in the cloud**), then the yellow banner *Cloud history review added*. Scroll to the review: *Getting worse*, *Linked to rain*, Open it: *Getting worse*, *Linked to rain*, numbered next checks | "With signal, cloud Gemini reviews it against this plot's history. It keeps following heavy rain, so drainage moves up the list." |
| 2:20–2:25 | **Me → chiShona.** The same result now reads *Kushaya nitrogen* and *Tarisa usati watenga chinhu* | "Grandmother reads it in Shona. Names and checks come from the guide, so they work offline in any language." |
| 2:25–2:45 | **iPhone**, same app (home-screen icon), banner says **Cloud** | "On a farmer's phone without on-device AI, the same app uses cloud Gemini automatically, and offline it saves observations and finishes them later. One hybrid SDK." |
| 2:45–2:57 | Quick cuts: code showing `PREFER_ON_DEVICE`, `responseConstraint`, `inferenceSource`; Firestore, App Check and Remote Config consoles | "Firebase AI Logic with Firestore offline sync, Auth, App Check and Remote Config." |
| 2:57–3:00 | End card with photo credits | "Munda: careful advice, even without signal." |

## Before filming
- [ ] MacBook shows **Works offline** (Nano downloaded; check `chrome://on-device-internals`)
- [ ] App Check debug token (local) or reCAPTCHA domains (hosted) set up, otherwise cloud calls fail
- [ ] History scenario from `docs/eval/scenarios.md` recorded on the demo plot
- [ ] Munda added to the iPhone home screen from the hosted URL (Safari → Share → Add to Home Screen)
- [ ] One full dry run with Wi-Fi off (on this Intel MacBook Nano takes 60–75 s per record; film the full wait once, speed it up in the edit)
- [ ] Do Not Disturb on both devices
- [ ] Name and area set on Me (e.g. Gogo, Wedza); extension officer number added so the call button shows
