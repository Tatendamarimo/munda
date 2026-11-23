# ADR 0001: Hybrid routing with explicit policy and truthful provenance

**Status:** Accepted, 2026-11-23

## Context
Farmers use Munda in fields with intermittent or no signal. Gemini Nano is fast, private and free, but it's only on some phones, its input window is about 4k tokens, it's single-turn only, and AICore throttles per app. Cloud Gemini is always capable but needs signal.

## Options
1. **SDK `PREFER_ON_DEVICE` only.** Simplest. But inputs over the limit fail or degrade, and the user can't know beforehand whether data stays on the phone.
2. **Fully custom routing with separate on-device and cloud stacks.** Maximum control, but duplicates what the SDK already does well.
3. **SDK hybrid model plus a thin pure policy layer** (`RoutingPolicy`) that picks on-device, cloud or queue from model state, connectivity and input size. Provenance comes from `response.inferenceSource`.

## Decision
Option 3. The hybrid model does the on-device work with automatic fallback. The policy handles what the SDK can't know (input too large for Nano, and "offline with no model" meaning save and queue) and drives a UI banner that tells the farmer where the AI will run before they tap. Each record stores the *actual* source reported by the SDK.

## Consequences
- The policy is unit-tested on the JVM (`RoutingPolicyTest`).
- The size limit is in Remote Config (`max_on_device_chars`) so it can be tuned without a release.
- **Tripwire:** if the SDK adds token counting for on-device input or multi-turn on-device chat, revisit the character heuristic and the two-call question flow.
