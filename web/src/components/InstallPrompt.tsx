import { useEffect, useState } from 'react';

const SNOOZE_KEY = 'explorarte.install.snoozed-until';
// Installing is not cosmetic: iOS wipes all origin storage after 7 days without
// interaction and only Home-Screen apps are exempt, so the ask comes back.
const SNOOZE_DAYS = 14;

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

function isSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
  } catch {
    /* private mode: the banner simply comes back next launch */
  }
}

/**
 * Install affordance. Chromium gets the real `beforeinstallprompt` flow; iOS has
 * no prompt API, so it gets the Add-to-Home-Screen steps instead.
 *
 * Rendered once from `main.tsx`, above everything else.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [hidden, setHidden] = useState(() => isStandalone() || isSnoozed());
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
  // Chromium: only offer once the browser says the app qualifies.
  // iOS: there is no such signal, so the manual instructions are always offered.
  if (!deferred && !ios) return null;

  const dismiss = () => {
    snooze();
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'dismissed') snooze();
    setHidden(true);
  };

  return (
    <div className="install-banner" role="region" aria-label="Instalar ExplorArte">
      <img className="install-banner__icon" src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-banner__copy">
        <p className="install-banner__title">Instala ExplorArte</p>
        <p className="install-banner__body">
          {ios
            ? 'En iPhone y iPad, la app solo guarda tus datos sin conexión si la agregas a la pantalla de inicio.'
            : 'Ábrela desde tu pantalla de inicio y úsala sin conexión.'}
        </p>
        {ios && iosHelpOpen && (
          <ol className="install-banner__steps">
            <li>
              Toca <strong>Compartir</strong> en la barra de Safari (el cuadrado con la flecha hacia
              arriba).
            </li>
            <li>
              Elige <strong>Agregar a inicio</strong>.
            </li>
            <li>
              Confirma con <strong>Agregar</strong>.
            </li>
          </ol>
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
