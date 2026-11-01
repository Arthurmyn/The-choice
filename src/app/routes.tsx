import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'menu' }
  | { name: 'stories' }
  | { name: 'archive' }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'play'; storyId: string }
  | { name: 'analysis'; storyId: string; run: string }
  | { name: 'map'; storyId: string; run: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, a, b] = parts;
  switch (head) {
    case 'stories':
      return { name: 'stories' };
    case 'archive':
      return { name: 'archive' };
    case 'settings':
      return { name: 'settings' };
    case 'about':
      return { name: 'about' };
    case 'play':
      return a ? { name: 'play', storyId: a } : { name: 'stories' };
    case 'analysis':
      return a ? { name: 'analysis', storyId: a, run: b ?? 'latest' } : { name: 'stories' };
    case 'map':
      return a ? { name: 'map', storyId: a, run: b ?? 'latest' } : { name: 'stories' };
    default:
      return { name: 'menu' };
  }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'menu':
      return '#/';
    case 'play':
      return `#/play/${encodeURIComponent(r.storyId)}`;
    case 'analysis':
    case 'map':
      return `#/${r.name}/${encodeURIComponent(r.storyId)}/${encodeURIComponent(r.run)}`;
    default:
      return `#/${r.name}`;
  }
}

/** Tiny hash router: refresh keeps the current screen and the back button works. */
export function useRoute(): { route: Route; go: (r: Route) => void } {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((r: Route) => {
    const hash = routeToHash(r);
    if (window.location.hash === hash || (hash === '#/' && !window.location.hash)) setRoute(r);
    else window.location.hash = hash;
  }, []);
  return { route, go };
}
