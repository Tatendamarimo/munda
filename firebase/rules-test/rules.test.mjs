// Firestore security rules tests. Run: npm install && npm test (needs Java for the emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';

let env;
const ORG = 'demo';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-munda',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const valid = (id, uid, overrides = {}) => ({
  schemaVersion: 1, id, orgId: ORG, ownerUid: uid, plot: 'River plot', plotKey: 'RIVER-PLOT', crop: 'MAIZE',
  cropStage: 'EARLY_GROWTH', description: 'Lower leaves yellowing', core: { area: 'PATCHES', rainfall: 'HEAVY', onset: 'THIS_WEEK' },
  followUps: [{ q: 'Which leaves?', a: 'Bottom' }], hadPhoto: false,
  record: { summary: 'Yellow lower leaves', symptoms: ['yellow'], possibleCauses: [], urgency: 'SOON', uncertaintyNote: 'n' },
  origin: 'ON_DEVICE', createdAtMillis: Date.now() - 3 * 86400000, reviewStatus: 'NOT_STARTED', review: null,
  recordError: null, syncedAt: serverTimestamp(), ...overrides,
});

const ref = (ctx, id) => doc(ctx.firestore(), `orgs/${ORG}/observations/${id}`);

test('author can create a valid observation, including one recorded offline days ago', async () => {
  const alice = env.authenticatedContext('alice');
  await assertSucceeds(setDoc(ref(alice, 'o1'), valid('o1', 'alice')));
});

test('pending observation (no record yet) is allowed', async () => {
  const alice = env.authenticatedContext('alice');
  await assertSucceeds(setDoc(ref(alice, 'o1'), valid('o1', 'alice', { record: null, origin: 'PENDING' })));
});

test('unauthenticated users cannot read or write', async () => {
  const anon = env.unauthenticatedContext();
  await assertFails(setDoc(ref(anon, 'o1'), valid('o1', 'nobody')));
  await assertFails(getDoc(ref(anon, 'o1')));
});

test('cannot create on behalf of someone else, or with a mismatched id', async () => {
  const alice = env.authenticatedContext('alice');
  await assertFails(setDoc(ref(alice, 'o1'), valid('o1', 'bob')));
  await assertFails(setDoc(ref(alice, 'o1'), valid('other', 'alice')));
});

test('rejects unknown fields, future timestamps, bad enums and oversized text', async () => {
  const alice = env.authenticatedContext('alice');
  await assertFails(setDoc(ref(alice, 'o1'), valid('o1', 'alice', { isAdmin: true })));
  await assertFails(setDoc(ref(alice, 'o2'), valid('o2', 'alice', { createdAtMillis: Date.now() + 86400000 })));
  await assertFails(setDoc(ref(alice, 'o3'), valid('o3', 'alice', { origin: 'MAGIC' })));
  await assertFails(setDoc(ref(alice, 'o4'), valid('o4', 'alice', { description: 'x'.repeat(8001) })));
  await assertFails(setDoc(ref(alice, 'o5'), valid('o5', 'alice', { reviewStatus: 'DONE' })));
});

test('other org members can read but not modify', async () => {
  const alice = env.authenticatedContext('alice');
  await setDoc(ref(alice, 'o1'), valid('o1', 'alice'));
  const bob = env.authenticatedContext('bob');
  await assertSucceeds(getDoc(ref(bob, 'o1')));
  await assertFails(updateDoc(ref(bob, 'o1'), { reviewStatus: 'DONE', updatedAt: serverTimestamp() }));
});

test('users in another org cannot read', async () => {
  const alice = env.authenticatedContext('alice');
  await setDoc(ref(alice, 'o1'), valid('o1', 'alice'));
  const eve = env.authenticatedContext('eve', { orgId: 'other-coop' });
  await assertFails(getDoc(ref(eve, 'o1')));
});

test('author can add record and review, but cannot rewrite the observation or delete it', async () => {
  const alice = env.authenticatedContext('alice');
  await setDoc(ref(alice, 'o1'), valid('o1', 'alice', { record: null, origin: 'PENDING' }));
  await assertSucceeds(updateDoc(ref(alice, 'o1'), {
    record: { summary: 's', symptoms: [], possibleCauses: [], urgency: 'ROUTINE', uncertaintyNote: 'n' },
    origin: 'CLOUD', recordError: null, updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(ref(alice, 'o1'), {
    reviewStatus: 'DONE', updatedAt: serverTimestamp(),
    review: { summary: 's', patterns: [], updatedCauses: [], nextChecks: ['Dig a root'], reviewedAtMillis: 1, historyConsidered: 2 },
  }));
  await assertFails(updateDoc(ref(alice, 'o1'), { description: 'edited', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(alice, 'o1'), { reviewStatus: 'DONE' })); // missing server timestamp
  await assertFails(deleteDoc(ref(alice, 'o1')));
});
