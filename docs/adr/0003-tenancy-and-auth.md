# ADR 0003: Anonymous auth with org claim seam

**Status:** Historical decision, superseded by [ADR 0007](0007-recoverable-accounts-and-onboarding.md), 2026-11-25. The shared `demo` organization described below is no longer used.

## Context
Farmers need to start with near-zero friction and then work offline. Cooperatives and extension groups need to share history across members. There's no admin backend yet.

## Decision
Anonymous Firebase Auth on first launch (needs one online session). Data lives under `orgs/{orgId}/observations`. `orgId` comes from a custom claim; without one, users share the `demo` org. Security rules enforce org-scoped reads, author-only writes, an immutable observation body, and no client deletes.

## Consequences
- In the default configuration, all users of a deployment share the `demo` org. This suits a single cooperative or a demo, but not multiple unrelated farms.
- **Tripwire:** before onboarding a second farm group, add a small admin function that sets `orgId` claims (and optionally phone sign-in for account recovery). No client or schema change is needed.
