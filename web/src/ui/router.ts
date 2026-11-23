import { useSyncExternalStore } from 'react';

/** Tiny hash router: works offline from the service-worker cache with no server rewrites. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const current = () => window.location.hash.replace(/^#/, '') || '/';

export const useRoute = () => useSyncExternalStore(subscribe, current);
export const navigate = (path: string) => { window.location.hash = path; };
export const back = () => (window.history.length > 1 ? window.history.back() : navigate('/'));
