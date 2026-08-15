/// <reference lib="webworker" />
/**
 * ExplorArte service worker (injectManifest).
 *
 * Scope of this file, deliberately narrow:
 *   1. Precache the app shell from the real build manifest.
 *   2. Serve navigations from the precached index.html so the app opens offline.
 *   3. Hand control of the update moment to the page (no surprise reloads).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THIS WORKER MUST NEVER BREAK: it does not cache API responses.
 *
 * Every `/api/**` GET carries an `Authorization: Bearer` header and the Spring
 * backend does not send `Vary: Authorization`. A Workbox route keyed by URL
 * would therefore hand one teacher's profile to the next person who opens the
 * app on a shared classroom tablet. Offline reads are served from IndexedDB by
 * the page, where the session is known. `/api/**` is denylisted from the
 * navigation fallback below and there is no runtime route that can match it.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Extension point: media (public, unauthenticated, cacheable) is routed here by
 * a later ticket. See MEDIA ROUTE below — add `registerRoute(...)` there without
 * touching anything else in this file.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { MEDIA_CACHE, isMediaUrl } from './lib/media-origins';
import { NAVIGATION_DENYLIST } from './sw-navigation';

declare const self: ServiceWorkerGlobalScope;

// Injected at build time by vite-plugin-pwa with the hashed build output.
precacheAndRoute(self.__WB_MANIFEST);
// Drops precaches written by older Workbox versions of this app.
cleanupOutdatedCaches();

// ── Navigations ─────────────────────────────────────────────────────────────
// Any in-app URL resolves to the precached shell; React Router takes it from
// there. Everything that is not an app screen is excluded.
const navigationRoute = new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: NAVIGATION_DENYLIST,
});
registerRoute(navigationRoute);

// ── Media (PWA-2.8) ─────────────────────────────────────────────────────────
// Serves cached files transparently to <img>, <video>, <audio> and any link, so
// what `media-cache.ts` downloaded from the page keeps working with no network.
// The page and this worker agree on what counts as media through one module,
// `lib/media-origins.ts`, which can never match `/api/`.
//
// Cache-first, not stale-while-revalidate: these bytes are immutable per URL
// (a new upload is a new object), so revalidating on every play would spend a
// teacher's data plan to learn nothing. Freshness is decided by the page, which
// knows the record's version — see needsUpdate() there.
registerRoute(
  ({ url }) => isMediaUrl(url.href),
  new CacheFirst({
    // The very same cache media-cache.ts writes into: a file the teacher
    // downloaded on purpose is served straight from here, and one that merely
    // played online is kept by this route for next time.
    cacheName: MEDIA_CACHE,
    plugins: [
      // Only complete responses. A 206 in the cache would break the slicing
      // RangeRequestsPlugin does below, and opaque cross-origin responses can't
      // be inspected, so caching them would hide a 404 as a playable file.
      new CacheableResponsePlugin({ statuses: [200] }),
      // MANDATORY for video. Safari always sends `Range` for media elements,
      // and without this the cached response is returned whole, which Safari
      // rejects — offline playback fails even though the bytes are right there.
      new RangeRequestsPlugin(),
      // A tablet is not a hard drive. purgeOnQuotaError lets the browser
      // reclaim this cache under storage pressure instead of failing writes
      // everywhere else in the app.
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 90 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// ── Update flow ─────────────────────────────────────────────────────────────
// skipWaiting is NOT automatic. A new worker installs and then waits; the page
// shows the "Actualizar" toast and only then sends SKIP_WAITING. Otherwise a
// deploy could swap the app out from under a half-written post.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Safe on its own: it only takes control of clients that have no controller
// yet (i.e. the very first load), never mid-session over a live page.
clientsClaim();
