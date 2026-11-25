# ADR 0007: Guest-first setup and recoverable email accounts

**Status:** Implemented, 2026-11-25. Supersedes ADR 0003.

Farmers choose their language before identity setup. They may continue with a Firebase anonymous identity, create an email/password account, or sign into an existing account. Name and area are optional, device-local preferences. Location permissions are deferred until the farmer enables weather. Offline model download is explicit and may be skipped.

Both web and Android persist setup progress and completed UIDs locally. The first activation/sign-in needs a connection. A previously authenticated guest can resume incomplete setup offline. Completing setup opens Home; repeat visits skip setup for that UID.

Private records belong to `u-<uid>` by default; organization claims and group memberships still control shared access. Upgrading a guest uses Firebase credential linking and retains the same UID. A credential collision does not sign into a different account: doing so would strand the guest's immutable, author-owned records. Account merging and transferring ownership are out of scope.

Signing into an existing account works without a cached local organization ID. Web organization fallback is tied to the cached UID to avoid reusing another identity's organization. Group re-entry reads existing membership rather than attempting an update that the rules prohibit.

Email/password and anonymous providers are enabled in `app-munda`. Live identity linking and password sign-in were checked with a newly created, disposable identity, subsequently removed. No real user records were modified and no verification or reset emails were sent during that check. Email deliverability remains to be verified with a consenting test inbox.

The setup/account strings ship in all seven existing languages. New translations are first drafts and require native-speaker review. Phone OTP and social sign-in, account merging, cloud profile settings, and account-switching/sign-out UX are separate follow-ups.
