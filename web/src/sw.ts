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
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
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

// ── MEDIA ROUTE (reserved) ──────────────────────────────────────────────────
// A later ticket registers the media handler here: public Supabase Storage URLs
// only, with RangeRequestsPlugin (without it, cached <video> playback fails in
// Safari). Anything added here must be unauthenticated and public — if a route
// can match `/api/`, it is wrong.

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
