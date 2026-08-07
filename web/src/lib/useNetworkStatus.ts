import { useSyncExternalStore } from 'react';

// Port of the RN useNetworkStatus (which wrapped @react-native-community/netinfo)
// onto browser APIs. Same hook shape, so consumers move over unchanged.
//
// `navigator.onLine` alone is not enough: it only reports whether the device is
// attached to *a* network. On the school wifi with an expired captive portal,
// or on a router with no upstream, it happily says `true` while every request
// fails — which is exactly the case where showing "sin conexion, contenido
// guardado" instead of a spinner matters most.
//
// So reachability is verified for real, and the check is made honest by CORS:
// the probe is a cross-origin GET to the API's own /actuator/health (permitAll,
// no auth). A captive portal can intercept the request and answer 200 with its
// login page, but it cannot forge the `Access-Control-Allow-Origin` header for
// our origin, so `fetch` rejects and we correctly conclude "not really online".
// A same-origin probe could not do this: the service worker might answer it
// from the cache and report success while offline.

const PROBE_TIMEOUT_MS = 4000;
/** How long a probe result is trusted before it is worth re-checking. */
const PROBE_TTL_MS = 15_000;
/** Background re-check cadence, only while the tab is visible. */
const PROBE_INTERVAL_MS = 30_000;

function probeUrl(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const explicit = env.VITE_NETWORK_PROBE_URL;
  if (explicit) return explicit;
  const base = env.VITE_API_URL;
  // No API configured (mock mode): there is nothing to be reachable, so
  // navigator.onLine is the whole truth and probing would only add noise.
  return base ? `${base.replace(/\/$/, '')}/actuator/health` : null;
}

type Reachability = 'unknown' | 'reachable' | 'unreachable';

interface NetworkState {
  /** navigator.onLine — necessary but not sufficient. */
  connected: boolean;
  reachable: Reachability;
  /** True while a probe is in flight. */
  checking: boolean;
  lastCheckedAt: number | null;
}

let state: NetworkState = {
  connected: typeof navigator === 'undefined' ? true : navigator.onLine,
  reachable: 'unknown',
  checking: false,
  lastCheckedAt: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<NetworkState>): void {
  const next = { ...state, ...patch };
  if (
    next.connected === state.connected &&
    next.reachable === state.reachable &&
    next.checking === state.checking &&
    next.lastCheckedAt === state.lastCheckedAt
  ) {
    return;
  }
  state = next;
  for (const l of listeners) l();
}

/**
 * Online means: the OS says we have a link AND the last reachability check did
 * not prove otherwise. `unknown` counts as online on purpose — the RN version
 * treated NetInfo's null the same way, so screens don't flash an offline banner
 * on every mount while the first probe is still running.
 */
function computeOnline(s: NetworkState): boolean {
  if (!s.connected) return false;
  return s.reachable !== 'unreachable';
}

/** Imperative read, for non-React modules (media sync, outbox replay). */
export function isOnline(): boolean {
  return computeOnline(state);
}

export function getNetworkState(): NetworkState {
  return state;
}

let inFlight: Promise<boolean> | null = null;

/**
 * Runs one reachability probe. Concurrent callers share the same request, and
 * a fresh result is reused rather than re-probed.
 */
export function checkReachability(force = false): Promise<boolean> {
  if (inFlight) return inFlight;

  const url = probeUrl();
  if (!url) return Promise.resolve(computeOnline(state));

  // The OS already told us there is no link; no request can succeed and a
  // failed fetch would only cost battery.
  if (!state.connected) {
    setState({ reachable: 'unreachable', lastCheckedAt: Date.now() });
    return Promise.resolve(false);
  }

  const fresh =
    state.lastCheckedAt !== null &&
    Date.now() - state.lastCheckedAt < PROBE_TTL_MS &&
    state.reachable !== 'unknown';
  if (fresh && !force) return Promise.resolve(computeOnline(state));

  setState({ checking: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  inFlight = fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    signal: controller.signal,
  })
    .then(() => {
      // Any CORS-passing response proves we reached the real backend — even a
      // 404 or a 503. We are testing the path, not the endpoint's health.
      setState({ reachable: 'reachable', checking: false, lastCheckedAt: Date.now() });
      return true;
    })
    .catch(() => {
      // Network error, timeout, or a CORS rejection (the captive portal case).
      setState({ reachable: 'unreachable', checking: false, lastCheckedAt: Date.now() });
      return false;
    })
    .finally(() => {
      clearTimeout(timer);
      inFlight = null;
    });

  return inFlight;
}

// ── browser wiring ───────────────────────────────────────────────────────────

let started = false;
let interval: ReturnType<typeof setInterval> | undefined;

function onOnline(): void {
  // The link is back, but that says nothing about the upstream — re-probe
  // before promising the user anything.
  setState({ connected: true, reachable: 'unknown', lastCheckedAt: null });
  void checkReachability(true);
}

function onOffline(): void {
  setState({ connected: false, reachable: 'unreachable', lastCheckedAt: Date.now() });
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void checkReachability();
}

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Cheap periodic re-check, paused while the tab is hidden so a backgrounded
  // PWA doesn't sit there burning the tablet's battery.
  interval = setInterval(() => {
    if (document.visibilityState === 'visible') void checkReachability();
  }, PROBE_INTERVAL_MS);
  void checkReachability();
}

function stop(): void {
  if (!started) return;
  started = false;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  clearInterval(interval);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stop();
  };
}

function getOnlineSnapshot(): boolean {
  return computeOnline(state);
}

/** Server snapshot: assume online so SSR/prerender never emits an offline UI. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Reactive online/offline flag. Same signature as the RN hook, so screens that
 * already call `useIsOnline()` need no change.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getOnlineSnapshot, getServerSnapshot);
}

function getStateSnapshot(): NetworkState {
  return state;
}

/** The full picture, for anything that wants to show "comprobando conexion…". */
export function useNetworkStatus(): NetworkState & { online: boolean } {
  const s = useSyncExternalStore(subscribe, getStateSnapshot, getStateSnapshot);
  return { ...s, online: computeOnline(s) };
}

/** Test-only reset of the module store and its browser listeners. */
export function __resetNetworkStatus(): void {
  stop();
  inFlight = null;
  state = {
    connected: typeof navigator === 'undefined' ? true : navigator.onLine,
    reachable: 'unknown',
    checking: false,
    lastCheckedAt: null,
  };
  listeners.clear();
}
