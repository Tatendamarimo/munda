import { getIdTokenResult, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { firebase } from './firebase';
import { Store } from './store';

export type SessionState =
  | { kind: 'loading' }
  /** Never activated on this device; needs one online sign-in before working offline. */
  | { kind: 'needsActivation' }
  | { kind: 'activating' }
  | { kind: 'ready'; uid: string; orgId: string }
  | { kind: 'error'; message: string };

const ORG_KEY = 'munda.orgId';
/** The old shared farm everyone without a group used to land in; nobody belongs there now. */
const LEGACY_SHARED_ORG = 'demo';

/**
 * The farm a user's records live in. A cooperative or extension group is an `orgId` custom
 * claim set by an admin; everyone else gets a private farm of their own, `u-<uid>`. Must match
 * myOrg() in firestore.rules and Session.kt on Android.
 */
export function orgFor(uid: string, claim: unknown): string {
  return typeof claim === 'string' && claim !== '' && claim !== LEGACY_SHARED_ORG ? claim : `u-${uid}`;
}

/**
 * Signs in anonymously (no email or password) and works out the user's farm (orgFor). The farm
 * is cached locally so the app keeps working offline. Same model as the Android client.
 */
class Session extends Store<SessionState> {
  constructor() {
    super({ kind: 'loading' });
  }

  start() {
    onAuthStateChanged(firebase().auth, (user) => {
      if (this.value.kind === 'activating') return;
      const cached = safeGet(ORG_KEY);
      if (!user || !cached) { this.set({ kind: 'needsActivation' }); return; }
      // Works offline: a cached "demo" (from before private farms) becomes the private farm.
      const orgId = orgFor(user.uid, cached);
      if (orgId !== cached) safeSet(ORG_KEY, orgId);
      this.set({ kind: 'ready', uid: user.uid, orgId });
    });
  }

  get ready(): Extract<SessionState, { kind: 'ready' }> | null {
    return this.value.kind === 'ready' ? this.value : null;
  }

  async activate() {
    if (this.value.kind === 'activating') return;
    this.set({ kind: 'activating' });
    try {
      const auth = firebase().auth;
      const user: User = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const claims = (await getIdTokenResult(user, true)).claims;
      const orgId = orgFor(user.uid, claims.orgId);
      safeSet(ORG_KEY, orgId);
      this.set({ kind: 'ready', uid: user.uid, orgId });
    } catch (e) {
      console.warn('Activation failed', e);
      this.set({ kind: 'error', message: "Couldn't set up. Connect to the internet once and try again." });
    }
  }
}

// localStorage can throw (private mode, storage disabled); treat as missing.
function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* best effort */ }
}

export const session = new Session();
