import { useEffect, useState } from 'react';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches === true ||
    window.navigator.standalone === true
  );
}

function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ reports a desktop Mac user agent; touch points give it away.
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * PWA installation affordance.
 *
 * It appears immediately when the site opens (unless it is already running
 * installed/standalone). Chromium/Android/desktop use the native
 * beforeinstallprompt event when the browser exposes it; iOS gets the manual
 * Safari → Add to Home Screen steps because iOS does not expose that event.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [hidden, setHidden] = useState(() => isStandalone());
  const ios = isIosLike();

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };

    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) {
      setFallbackOpen(true);
      return;
    }

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setHidden(true);
  };

  return (
    <div className="install-banner" role="region" aria-label="Instalar Sueños y Letras">
      <img className="install-banner__icon" src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-banner__copy">
        <p className="install-banner__title">Instala Sueños y Letras</p>
        <p className="install-banner__body">
          {ios
            ? 'Agrégala a la pantalla de inicio para abrirla como una app en tu iPhone o iPad.'
            : 'Instálala en tu dispositivo para abrirla como una app desde el escritorio o la pantalla de inicio.'}
        </p>

        {ios && iosHelpOpen && (
          <ol className="install-banner__steps">
            <li>
              Toca <strong>Compartir</strong> en Safari.
            </li>
            <li>
              Elige <strong>Agregar a pantalla de inicio</strong>.
            </li>
            <li>
              Confirma con <strong>Agregar</strong>.
            </li>
          </ol>
        )}

        {!ios && fallbackOpen && (
          <p className="install-banner__fallback">
            Usa el icono de instalación de la barra de direcciones de Chrome o Edge. Si no aparece,
            abre el menú del navegador y busca <strong>Instalar Sueños y Letras</strong>.
          </p>
        )}
      </div>

      <div className="install-banner__actions">
        {ios ? (
          <button
            type="button"
            className="install-banner__cta"
            aria-expanded={iosHelpOpen}
            onClick={() => setIosHelpOpen((v) => !v)}>
            {iosHelpOpen ? 'Entendido' : 'Cómo'}
          </button>
        ) : (
          <button type="button" className="install-banner__cta" onClick={install}>
            Instalar
          </button>
        )}

        <button type="button" className="install-banner__dismiss" onClick={dismiss}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
