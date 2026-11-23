import { useMemo, useSyncExternalStore } from 'react';
import { href, parseRoute, type Route } from './routes';

export { href, parseRoute, tabOf, type Route, type Tab } from './routes';

/** Tiny hash router: works offline from the service-worker cache with no server rewrites. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const current = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, current);
  return useMemo(() => parseRoute(hash), [hash]);
}
export const navigate = (r: Route) => { window.location.hash = href(r).slice(1); };
export const back = () => (window.history.length > 1 ? window.history.back() : navigate({ name: 'home' }));
