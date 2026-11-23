# ADR 0002: Possible causes with enforced uncertainty, not diagnoses

**Status:** Accepted, 2026-11-23

## Context
Crop symptoms are ambiguous: yellowing alone fits at least five common causes. A confident wrong answer can cost a farmer money on the wrong inputs or delay action on a spreading pest. Small on-device models are more likely to overstate confidence.

## Decision
- The output schema is a list of `PossibleCause` entries, each with a likelihood, supporting evidence, contradicting or missing evidence, and a field check. A single "diagnosis" field is not representable.
- `ModelOutputParser` enforces the rules regardless of model behaviour: Likely requires at least 2 supporting observations; at most one Likely cause; every cause has a check; guide ids and history references must be ones we sent.
- Answers are grounded in an embedded, curated maize guide. Retrieval runs on the phone so the small model reasons from relevant reference text rather than memory.
- Deterministic history rules (recurring, spreading, worsening, rain-linked) run before the cloud review, so the key signals are reproducible.

## Consequences
- Answers are sometimes less decisive. That is intended, and the UI frames it ("what would change this assessment").
- **Tripwire:** if field testing shows the "one Likely" cap hides genuinely co-occurring problems (e.g. nitrogen deficiency *and* waterlogging after floods), allow two Likely causes only when both have independent supporting evidence.
