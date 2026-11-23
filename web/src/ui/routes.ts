/** Every screen, as data. Pure (no React/DOM) so it's unit-tested. Hash routes work offline from the service-worker cache. */
export type Route =
  | { name: 'home' }
  | { name: 'plots' }
  | { name: 'plot'; key: string }
  | { name: 'guide' }
  | { name: 'guideEntry'; id: string }
  | { name: 'me' }
  | { name: 'observe' }
  | { name: 'record'; id: string };

export type Tab = 'home' | 'plots' | 'guide' | 'me';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const [, a = '', b, ...rest] = path.split('/');
  if (rest.length) return { name: 'home' };
  const id = b ? decodeURIComponent(b) : '';
  switch (a) {
    case '': return { name: 'home' };
    case 'plots': return b === undefined ? { name: 'plots' } : id ? { name: 'plot', key: id } : { name: 'home' };
    case 'guide': return b === undefined ? { name: 'guide' } : id ? { name: 'guideEntry', id } : { name: 'home' };
    case 'me': return b === undefined ? { name: 'me' } : { name: 'home' };
    case 'observe': return b === undefined ? { name: 'observe' } : { name: 'home' };
    case 'o': return id ? { name: 'record', id } : { name: 'home' };
    default: return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home': return '#/';
    case 'plots': return '#/plots';
    case 'plot': return `#/plots/${encodeURIComponent(r.key)}`;
    case 'guide': return '#/guide';
    case 'guideEntry': return `#/guide/${encodeURIComponent(r.id)}`;
    case 'me': return '#/me';
    case 'observe': return '#/observe';
    case 'record': return `#/o/${encodeURIComponent(r.id)}`;
  }
}

/** Which tab a screen belongs to; null for full-screen flows. */
export function tabOf(r: Route): Tab | null {
  switch (r.name) {
    case 'home': return 'home';
    case 'plots': case 'plot': case 'record': return 'plots';
    case 'guide': case 'guideEntry': return 'guide';
    case 'me': return 'me';
    case 'observe': return null;
  }
}
