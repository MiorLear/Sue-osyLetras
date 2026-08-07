/**
 * Navigation-fallback denylist for the service worker.
 *
 * Lives outside `sw.ts` so it can be unit tested without a ServiceWorker
 * global. `sw.ts` is the only consumer.
 */

/** URLs that must NOT be answered with the precached app shell. */
export const NAVIGATION_DENYLIST: RegExp[] = [
  // The API is proxied to Cloud Run and is never cached by the worker: every
  // GET is Bearer-scoped and the backend sends no `Vary: Authorization`.
  /^\/api\//,
  // Host/browser well-known endpoints (ACME, apple-app-site-association...).
  /^\/\.well-known\//,
  // Anything that looks like a real file — let precache or the network answer.
  /^\/[^?]*\.[^./?]+$/,
];

/** True when `pathname` must bypass the app-shell fallback. */
export function isDeniedNavigation(pathname: string): boolean {
  return NAVIGATION_DENYLIST.some((re) => re.test(pathname));
}
