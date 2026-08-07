import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and surfaces new versions as an opt-in banner.
 *
 * The worker never calls `skipWaiting()` on its own: a deploy landing while a
 * teacher is halfway through a post must not reload the tab out from under her.
 * The new worker installs, waits, and only swaps when she taps "Actualizar".
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // A failed registration must never take the app down with it: the site
      // still works online, it just will not work offline.
      console.error('[pwa] no se pudo registrar el service worker', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner__copy">
        <p className="update-banner__title">Hay una versión nueva</p>
        <p className="update-banner__body">
          Se aplicará cuando quieras. Tu trabajo sin guardar no se pierde si esperas.
        </p>
      </div>
      <div className="update-banner__actions">
        {/* `true` posts SKIP_WAITING to the waiting worker and reloads once it
            takes control — the only place in the app allowed to do that. */}
        <button
          type="button"
          className="update-banner__cta"
          onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
        <button
          type="button"
          className="update-banner__dismiss"
          onClick={() => setNeedRefresh(false)}>
          Después
        </button>
      </div>
    </div>
  );
}
