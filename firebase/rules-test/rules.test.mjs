// Firestore security rules tests. Run: npm install && npm test (needs Java for the emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';

let env;
// A cooperative set up by an admin (orgId claim). People without one have a private farm.
const ORG = 'wedza-coop';
const member = (uid) => env.authenticatedContext(uid, { orgId: ORG });

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
  const alice = member('alice');
  await assertSucceeds(setDoc(ref(alice, 'o1'), valid('o1', 'alice')));
});

test('pending observation (no record yet) is allowed', async () => {
  const alice = member('alice');
  await assertSucceeds(setDoc(ref(alice, 'o1'), valid('o1', 'alice', { record: null, origin: 'PENDING' })));
});

test('unauthenticated users cannot read or write', async () => {
  const anon = env.unauthenticatedContext();
  await assertFails(setDoc(ref(anon, 'o1'), valid('o1', 'nobody')));
  await assertFails(getDoc(ref(anon, 'o1')));
});

test('cannot create on behalf of someone else, or with a mismatched id', async () => {
  const alice = member('alice');
  await assertFails(setDoc(ref(alice, 'o1'), valid('o1', 'bob')));
  await assertFails(setDoc(ref(alice, 'o1'), valid('other', 'alice')));
});

test('rejects unknown fields, future timestamps, bad enums and oversized text', async () => {
  const alice = member('alice');
  await assertFails(setDoc(ref(alice, 'o1'), valid('o1', 'alice', { isAdmin: true })));
  await assertFails(setDoc(ref(alice, 'o2'), valid('o2', 'alice', { createdAtMillis: Date.now() + 86400000 })));
  await assertFails(setDoc(ref(alice, 'o3'), valid('o3', 'alice', { origin: 'MAGIC' })));
  await assertFails(setDoc(ref(alice, 'o4'), valid('o4', 'alice', { description: 'x'.repeat(8001) })));
  await assertFails(setDoc(ref(alice, 'o5'), valid('o5', 'alice', { reviewStatus: 'DONE' })));
});

test('other org members can read but not modify', async () => {
  const alice = member('alice');
  await setDoc(ref(alice, 'o1'), valid('o1', 'alice'));
  const bob = member('bob');
  await assertSucceeds(getDoc(ref(bob, 'o1')));
  await assertFails(updateDoc(ref(bob, 'o1'), { reviewStatus: 'DONE', updatedAt: serverTimestamp() }));
});

test('users in another org cannot read', async () => {
  const alice = member('alice');
  await setDoc(ref(alice, 'o1'), valid('o1', 'alice'));
  const eve = env.authenticatedContext('eve', { orgId: 'other-coop' });
  await assertFails(getDoc(ref(eve, 'o1')));
});

test('a farmer without a group has a private farm nobody else can see', async () => {
  const solo = (uid) => env.authenticatedContext(uid);
  const mine = (ctx, uid, id) => doc(ctx.firestore(), `orgs/u-${uid}/observations/${id}`);
  await assertSucceeds(setDoc(mine(solo('tendai'), 'tendai', 'o1'), valid('o1', 'tendai', { orgId: 'u-tendai' })));
  await assertSucceeds(getDoc(mine(solo('tendai'), 'tendai', 'o1')));
  await assertFails(getDoc(mine(solo('rudo'), 'tendai', 'o1')));
  await assertFails(setDoc(mine(solo('rudo'), 'tendai', 'o2'), valid('o2', 'rudo', { orgId: 'u-tendai' })));
  // Nobody can use the old shared farm any more, with or without a "demo" claim.
  const shared = (ctx, id) => doc(ctx.firestore(), `orgs/demo/observations/${id}`);
  await assertFails(setDoc(shared(solo('tendai'), 'o3'), valid('o3', 'tendai', { orgId: 'demo' })));
  await assertFails(getDoc(shared(env.authenticatedContext('x', { orgId: 'demo' }), 'o3')));
});

test('author can add record and review, but cannot rewrite the observation or delete it', async () => {
  const alice = member('alice');
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

// ---- Groups (a cooperative with an extension officer) ----
const G = 'g-7KQ2MX';
const gdoc = (ctx, path) => doc(ctx.firestore(), path);
const user = (uid) => env.authenticatedContext(uid);
async function makeGroup(officer = 'olivia') {
  const o = user(officer);
  await assertSucceeds(setDoc(gdoc(o, `orgs/${G}`), { name: 'Wedza coop', createdBy: officer, createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(gdoc(o, `orgs/${G}/members/${officer}`), { role: 'officer', name: 'Olivia', joinedAt: serverTimestamp() }));
}

test('an officer creates a group; only the creator can be its officer', async () => {
  await makeGroup();
  await assertFails(setDoc(gdoc(user('fred'), `orgs/${G}/members/fred`), { role: 'officer', name: 'Fred', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(gdoc(user('x'), 'orgs/not-a-group'), { name: 'n', createdBy: 'x', createdAt: serverTimestamp() }));
});

test('a farmer joins with the code and reports into the group; the officer reads it', async () => {
  await makeGroup();
  const fred = user('fred');
  await assertSucceeds(setDoc(gdoc(fred, `orgs/${G}/members/fred`), { role: 'farmer', name: 'Fred', joinedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(gdoc(fred, `orgs/${G}/observations/o1`), valid('o1', 'fred', { orgId: G, area: 'Wedza', cell: '-18.60,31.55' })));
  await assertSucceeds(getDoc(gdoc(user('olivia'), `orgs/${G}/observations/o1`)));
  // Not a member: cannot read or write the group.
  await assertFails(getDoc(gdoc(user('eve'), `orgs/${G}/observations/o1`)));
  await assertFails(setDoc(gdoc(user('eve'), `orgs/${G}/observations/o2`), valid('o2', 'eve', { orgId: G })));
  // Cannot join a group that doesn't exist.
  await assertFails(setDoc(gdoc(user('eve'), 'orgs/g-AAAAAA/members/eve'), { role: 'farmer', name: 'Eve', joinedAt: serverTimestamp() }));
});

test('only the officer confirms alerts; members read them', async () => {
  await makeGroup();
  const fred = user('fred');
  await setDoc(gdoc(fred, `orgs/${G}/members/fred`), { role: 'farmer', name: 'Fred', joinedAt: serverTimestamp() });
  const alert = (by) => ({ problem: 'fall_armyworm', area: 'Wedza', count: 4, message: 'Fall armyworm confirmed on 4 farms. Check your maize.', confirmedBy: by, createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(gdoc(user('olivia'), `orgs/${G}/alerts/a1`), alert('olivia')));
  await assertFails(setDoc(gdoc(fred, `orgs/${G}/alerts/a2`), alert('fred')));
  await assertSucceeds(getDoc(gdoc(fred, `orgs/${G}/alerts/a1`)));
  await assertFails(getDoc(gdoc(user('eve'), `orgs/${G}/alerts/a1`)));
});

test('a check may carry a coarse area, nothing finer', async () => {
  const alice = member('alice');
  await assertSucceeds(setDoc(ref(alice, 'o9'), valid('o9', 'alice', { area: 'Wedza', cell: '-18.60,31.55' })));
  await assertFails(setDoc(ref(alice, 'o10'), valid('o10', 'alice', { lat: -18.6123, lng: 31.5711 })));
});
