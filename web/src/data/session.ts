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
const DEFAULT_ORG = 'demo';

/**
 * Tenancy comes from an `orgId` custom claim (set by an admin backend for real farm groups);
 * without one, users share the "demo" org, matching firestore.rules. The org is cached locally
 * so the app keeps working offline. Same model as the Android client.
 */
class Session extends Store<SessionState> {
  constructor() {
    super({ kind: 'loading' });
  }

  start() {
    onAuthStateChanged(firebase().auth, (user) => {
      if (this.value.kind === 'activating') return;
      const org = safeGet(ORG_KEY);
      this.set(user && org ? { kind: 'ready', uid: user.uid, orgId: org } : { kind: 'needsActivation' });
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
      const orgId = typeof claims.orgId === 'string' && claims.orgId ? claims.orgId : DEFAULT_ORG;
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
