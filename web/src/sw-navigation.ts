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
  // Media is proxied to the same Cloud Run service and answered by the media
  // route, never by the app shell. The "looks like a file" rule below already
  // covers `/media/foo.pdf`, but an object stored without an extension would
  // otherwise be handed the HTML shell — which reads as a corrupt download.
  /^\/media\//,
  // Host/browser well-known endpoints (ACME, apple-app-site-association...).
  /^\/\.well-known\//,
  // Anything that looks like a real file — let precache or the network answer.
  /^\/[^?]*\.[^./?]+$/,
];

/** True when `pathname` must bypass the app-shell fallback. */
export function isDeniedNavigation(pathname: string): boolean {
  return NAVIGATION_DENYLIST.some((re) => re.test(pathname));
}
