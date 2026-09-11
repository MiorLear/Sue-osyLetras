/**
 * Hands control to a waiting service worker, on demand.
 *
 * The app deliberately never calls `skipWaiting()` on its own (see UpdateToast):
 * a deploy landing mid-post must not reload the tab out from under a teacher.
 * But that policy has a cost on the auth screens. A worker installed before the
 * navigation denylist learned about `/__/` answers Firebase's popup at
 * `/__/auth/handler` with the cached app shell, so Google sign-in fails with a
 * misleading error until someone taps "Actualizar" — which nobody does, because
 * the banner is not why they opened the app.
 *
 * Login and Register have no unsaved work, so they are the one place allowed to
 * force the swap. Everywhere else keeps waiting for the user's consent.
 *
 * Uses the platform APIs rather than `useRegisterSW`: that hook owns a single
 * registration lifecycle and is already mounted once, in UpdateToast.
 */

export interface ActivateOptions {
  /** How long to wait for the new worker to take control. */
  timeoutMs?: number;
  /** Ask the browser for a fresh `sw.js` first — for clients that never fetched it. */
  checkForUpdate?: boolean;
  /** Injectable for tests. */
  container?: ServiceWorkerContainer;
}

/**
 * @returns true when a new worker took control — the caller must reload, since
 * `cleanupOutdatedCaches()` has just dropped the hashed assets this page holds.
 */
export async function activateWaitingServiceWorker({
  timeoutMs = 800,
  checkForUpdate = false,
  container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
}: ActivateOptions = {}): Promise<boolean> {
  if (!container) return false;

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await container.getRegistration();
  } catch {
    // A blocked or unsupported registration must never break sign-in.
    return false;
  }
  if (!registration) return false;

  if (checkForUpdate) {
    // Bounded: on a slow network `update()` can hang, and the click path that
    // calls this is spending the user's popup gesture while it waits.
    await Promise.race([
      registration.update().catch(() => undefined),
      sleep(timeoutMs),
    ]);
  }

  const waiting = registration.waiting;
  if (!waiting) return false;

  const controllerChanged = nextControllerChange(container, timeoutMs);
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return controllerChanged;
}

/**
 * Activates a waiting worker on mount and reloads, which is what the auth
 * screens want: the swap alone fixes Google sign-in, and the reload realigns
 * the page with the assets the new worker kept.
 *
 * The reload is skipped while a field has focus — losing a half-typed password
 * to a background update is worse than a page holding slightly stale chunks,
 * and the swap (the part that matters) already happened either way.
 */
export async function refreshServiceWorkerForAuthScreen(
  options: ActivateOptions = {},
): Promise<void> {
  const activated = await activateWaitingServiceWorker({
    checkForUpdate: true,
    timeoutMs: 3000,
    ...options,
  });
  if (!activated || isTyping()) return;
  window.location.reload();
}

function isTyping(): boolean {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextControllerChange(container: ServiceWorkerContainer, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer);
      container.removeEventListener('controllerchange', onChange);
      resolve(value);
    };
    const onChange = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    container.addEventListener('controllerchange', onChange);
  });
}
