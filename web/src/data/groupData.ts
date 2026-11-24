import { addDoc, collection, getCountFromServer, limit, onSnapshot, orderBy, query, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { firebase } from './firebase';

export interface GroupAlert { id: string; problem: string; area: string | null; count: number; message: string; createdAt: number }

/** Confirmed alerts for a group, newest first (members read them; only the officer writes them). */
export function observeAlerts(orgId: string, onChange: (alerts: GroupAlert[]) => void): Unsubscribe {
  const q = query(collection(firebase().db, 'orgs', orgId, 'alerts'), orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, problem: String(x.problem ?? ''), area: typeof x.area === 'string' ? x.area : null, count: Number(x.count ?? 0),
      message: String(x.message ?? ''), createdAt: x.createdAt?.toMillis?.() ?? Date.now() };
  })), (e) => console.warn('Alerts listener error', e));
}

export function confirmAlert(orgId: string, uid: string, a: { problem: string; area: string | null; count: number; message: string }) {
  return addDoc(collection(firebase().db, 'orgs', orgId, 'alerts'), { ...a, confirmedBy: uid, createdAt: serverTimestamp() });
}

export async function memberCount(orgId: string): Promise<number | null> {
  try { return (await getCountFromServer(collection(firebase().db, 'orgs', orgId, 'members'))).data().count; } catch { return null; }
}
