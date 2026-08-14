import { useEffect, useRef } from 'react';
import { settleConfirm, usePendingConfirm } from './confirm-store';

/**
 * Host for `confirmDialog()`. Mounted once from `main.tsx`.
 *
 * Built on a real `<dialog>` opened with `showModal()`, which gives focus
 * trapping, the top layer and Escape-to-close for free — and correctly, which
 * hand-rolled modals rarely manage.
 */
export function ConfirmDialog() {
  const request = usePendingConfirm();
  const ref = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // jsdom does not implement <dialog>; fall back to the `open` attribute so
    // the component stays testable without weakening the browser behaviour.
    if (!request) {
      if (!el.open) return;
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
      return;
    }
    if (!el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    }
    // Focus the safe action, not the destructive one.
    confirmRef.current?.focus();
  }, [request]);

  // Escape fires `cancel`; treat it exactly like pressing "Cancelar".
  const onCancel = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    settleConfirm(false);
  };

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={onCancel}
      onClose={() => settleConfirm(false)}>
      {request && (
        <div key={request.id} className="confirm-dialog__inner">
          <h2 className="confirm-dialog__title" id="confirm-dialog-title">
            {request.title}
          </h2>
          {request.message && <p className="confirm-dialog__message">{request.message}</p>}
          <div className="confirm-dialog__actions">
            <button
              type="button"
              className="confirm-dialog__cancel"
              onClick={() => settleConfirm(false)}>
              {request.cancelLabel ?? 'Cancelar'}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className={
                request.tone === 'danger'
                  ? 'confirm-dialog__confirm confirm-dialog__confirm--danger'
                  : 'confirm-dialog__confirm'
              }
              onClick={() => settleConfirm(true)}>
              {request.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
