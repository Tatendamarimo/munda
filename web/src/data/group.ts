import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { isGroupId, newGroupId, normalizeCode } from '../domain/groups';
import { firebase } from './firebase';
import { Store } from './store';

export interface Group { orgId: string; name: string; role: 'officer' | 'farmer' }

const KEY = 'munda.group';
const read = (): Group | null => { try { const g = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return g && isGroupId(g.orgId) ? g : null; } catch { return null; } };
const save = (g: Group | null) => { try { if (g) localStorage.setItem(KEY, JSON.stringify(g)); else localStorage.removeItem(KEY); } catch { /* best effort */ } };

/**
 * The cooperative this device reports into, if any. While in a group, new checks go to the
 * group's farm (the officer sees them); leaving returns to the private farm, whose records stay.
 */
export const group = new Store<Group | null>(typeof window === 'undefined' ? null : read());

function set(g: Group | null) { save(g); group.set(g); }

/** An officer starts a group; its id is the code farmers type to join. */
export async function createGroup(uid: string, name: string, myName: string): Promise<Group> {
  const { db } = firebase();
  const orgId = newGroupId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'orgs', orgId), { name: name.trim().slice(0, 60), createdBy: uid, createdAt: serverTimestamp() });
  batch.set(doc(db, 'orgs', orgId, 'members', uid), { role: 'officer', name: myName.trim().slice(0, 40) || null, joinedAt: serverTimestamp() });
  await batch.commit();
  const g: Group = { orgId, name: name.trim(), role: 'officer' };
  set(g);
  return g;
}

/** Joining needs signal once: the rules check the group exists. Throws if the code is wrong. */
export async function joinGroup(uid: string, code: string, myName: string): Promise<Group> {
  const orgId = normalizeCode(code);
  if (!isGroupId(orgId)) throw new Error('bad-code');
  const { db } = firebase();
  const { getDoc } = await import('firebase/firestore');
  const existing = await getDoc(doc(db, 'orgs', orgId, 'members', uid)).catch(() => null);
  try {
    if (!existing?.exists()) await setDoc(doc(db, 'orgs', orgId, 'members', uid), { role: 'farmer', name: myName.trim().slice(0, 40) || null, joinedAt: serverTimestamp() });
  } catch {
    throw new Error('not-found');
  }
  const snap = await getDoc(doc(db, 'orgs', orgId)).catch(() => null);
  const g: Group = { orgId, name: (snap?.data()?.name as string | undefined) ?? orgId.slice(2), role: existing?.get('role') === 'officer' ? 'officer' : 'farmer' };
  set(g);
  return g;
}

export async function leaveGroup(uid: string): Promise<void> {
  const g = group.value;
  if (!g) return;
  set(null);
  await deleteDoc(doc(firebase().db, 'orgs', g.orgId, 'members', uid)).catch(() => {});
}
