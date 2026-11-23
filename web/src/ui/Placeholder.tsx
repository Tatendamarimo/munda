import { PageHead } from './Header';
import type { Route } from './router';

/** Temporary body for tabs built in later tasks. */
export function Placeholder({ route }: { route: Route }) {
  return <PageHead title={route.name} />;
}
