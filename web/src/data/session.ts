import { createUserWithEmailAndPassword, EmailAuthProvider, getIdTokenResult, linkWithCredential, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { firebase } from './firebase';
import { group } from './group';
import { Store } from './store';

export type SessionState = { kind: 'loading' } | { kind: 'needsActivation' } | { kind: 'activating' } | { kind: 'ready'; uid: string; orgId: string } | { kind: 'error'; message: string };
export type AccountState = { kind: 'loading' | 'signedOut' } | { kind: 'guest'; uid: string } | { kind: 'member'; uid: string; email: string | null; verified: boolean };
export const account = new Store<AccountState>({ kind: 'loading' });
const ORG_KEY = 'munda.orgId';
const UID_KEY = 'munda.sessionUid';
export function orgFor(uid: string, claim: unknown): string {
  return typeof claim === 'string' && claim !== '' && claim !== 'demo' ? claim : `u-${uid}`;
}
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* works for this session */ } }

/** Anonymous identities may be linked, never silently replaced by another account. */
class Session extends Store<SessionState> {
  private running = false;
  private version = 0;
  constructor() { super({ kind: 'loading' }); }
  start() {
    group.subscribe(() => {
      const r = this.ready;
      if (r) this.set({ ...r, orgId: group.value?.orgId ?? orgFor(r.uid, safeGet(ORG_KEY)) });
    });
    onAuthStateChanged(firebase().auth, (user) => {
      if (this.running) return;
      if (!user) { this.version++; account.set({ kind: 'signedOut' }); this.set({ kind: 'needsActivation' }); return; }
      void this.accept(user);
    });
  }
  get ready(): Extract<SessionState, { kind: 'ready' }> | null { return this.value.kind === 'ready' ? this.value : null; }
  private async accept(user: User) {
    const version = ++this.version;
    const oldUid = safeGet(UID_KEY);
    if (oldUid && oldUid !== user.uid) {
      group.set(null);
      try { localStorage.removeItem('munda.group'); } catch { /* best effort */ }
    }
    let claim: unknown;
    try { claim = (await getIdTokenResult(user)).claims.orgId; }
    catch {
      // An expired token must not stop a previously configured device opening offline.
      const cached = safeGet(ORG_KEY);
      claim = oldUid === user.uid || cached === `u-${user.uid}` ? cached : undefined;
    }
    if (version !== this.version) return;
    const orgId = orgFor(user.uid, claim);
    safeSet(ORG_KEY, orgId); safeSet(UID_KEY, user.uid);
    account.set(user.isAnonymous ? { kind: 'guest', uid: user.uid } : { kind: 'member', uid: user.uid, email: user.email, verified: user.emailVerified });
    this.set({ kind: 'ready', uid: user.uid, orgId: group.value?.orgId ?? orgId });
  }
  private async run(fn: () => Promise<User>) {
    if (this.running) throw { code: 'auth/cancelled-popup-request' };
    this.running = true;
    try { const user = await fn(); await this.accept(user); }
    finally { this.running = false; }
  }
  async activate(): Promise<boolean> {
    if (this.running) return false;
    this.set({ kind: 'activating' });
    try { await this.run(async () => firebase().auth.currentUser ?? (await signInAnonymously(firebase().auth)).user); return true; }
    catch { this.set({ kind: 'error', message: 'Connect to the internet and try again.' }); return false; }
  }
  async createEmail(email: string, password: string) {
    return this.run(async () => {
      const auth = firebase().auth;
      if (auth.currentUser?.isAnonymous) return (await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email.trim(), password))).user;
      if (auth.currentUser) throw { code: 'munda/already-signed-in' };
      return (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
    });
  }
  async signInEmail(email: string, password: string) {
    return this.run(async () => {
      const auth = firebase().auth;
      // In particular, never replace a guest identity if an existing email collides during linking.
      if (auth.currentUser) throw { code: 'munda/protect-first' };
      return (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
    });
  }
  async resetPassword(email: string) { await sendPasswordResetEmail(firebase().auth, email.trim()); }
  async verifyEmail() { const user = firebase().auth.currentUser; if (user && !user.isAnonymous && !user.emailVerified) await sendEmailVerification(user); }
  async refreshAccount() { const user = firebase().auth.currentUser; if (user) { await user.reload(); await this.accept(user); } }
}
export const session = new Session();

/** Stable UI keys; never display raw provider errors or leak whether an account exists on sign-in. */
export function authIssue(error: unknown): 'credentials' | 'emailInUse' | 'weakPassword' | 'invalidEmail' | 'network' | 'disabled' | 'tooMany' | 'protectFirst' | 'unknown' {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'credentials';
    case 'auth/email-already-in-use': case 'auth/credential-already-in-use': return 'emailInUse';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements': return 'weakPassword';
    case 'auth/invalid-email': return 'invalidEmail';
    case 'auth/network-request-failed': return 'network';
    case 'auth/operation-not-allowed': case 'auth/unauthorized-domain': return 'disabled';
    case 'auth/too-many-requests': return 'tooMany';
    case 'munda/protect-first': case 'munda/already-signed-in': return 'protectFirst';
    default: return 'unknown';
  }
}
