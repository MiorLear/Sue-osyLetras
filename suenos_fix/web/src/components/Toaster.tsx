import { Icon } from './Icon';
import { dismissToast, useToasts, type ToastTone } from './toast-store';

const ICON: Record<ToastTone, 'check-circle' | 'bell' | 'help-circle'> = {
  success: 'check-circle',
  error: 'bell',
  info: 'help-circle',
};

/**
 * Renders the toast stack. Mounted once from `main.tsx`.
 *
 * The live region is the wrapper, not each toast: it exists from first paint so
 * screen readers announce arrivals instead of ignoring a region that appeared
 * at the same time as its content. `polite` never interrupts what is being read.
 */
export function Toaster() {
  const toasts = useToasts();

  return (
    <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="toast__icon" aria-hidden="true">
            <Icon name={ICON[t.tone]} size={17} color="currentColor" />
          </span>
          <div className="toast__copy">
            {t.title && <p className="toast__title">{t.title}</p>}
            <p className="toast__message">{t.message}</p>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Cerrar aviso">
            <Icon name="x" size={15} color="currentColor" />
          </button>
        </div>
      ))}
    </div>
  );
}
