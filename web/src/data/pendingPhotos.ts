/**
 * Photos of checks saved before they could be finished (offline, no on-device AI). Kept on this
 * device only, in IndexedDB, never in the synced records; used once when signal returns to
 * finish the check from the photo, then deleted.
 */
const DB = 'munda-pending-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const pendingPhotos = {
  put: (observationId: string, jpegBase64: string) => tx('readwrite', (s) => s.put(jpegBase64, observationId)).then(() => undefined).catch(() => undefined),
  get: (observationId: string) => tx<string | undefined>('readonly', (s) => s.get(observationId)).catch(() => undefined),
  delete: (observationId: string) => tx('readwrite', (s) => s.delete(observationId)).then(() => undefined).catch(() => undefined),
};
