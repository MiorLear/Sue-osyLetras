import { useSyncExternalStore } from 'react';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red — deletions and the like. */
  tone?: 'danger' | 'default';
}

interface PendingConfirm extends ConfirmRequest {
  id: number;
  resolve: (value: boolean) => void;
}

let pending: PendingConfirm | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Non-blocking replacement for `window.confirm`.
 *
 * Same call shape as the native one — `if (!(await confirmDialog(...))) return;`
 * — so call sites stay a one-line change, but it can be styled, it announces
 * itself properly and it does not freeze the main thread.
 */
export function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  // A second ask while one is open cancels the first: two stacked modal
  // dialogs is never what the caller meant.
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...request, id: nextId++, resolve };
    emit();
  });
}

/** Settles the open request. Called by the dialog host only. */
export function settleConfirm(value: boolean) {
  const current = pending;
  if (!current) return;
  pending = null;
  emit();
  current.resolve(value);
}

export function usePendingConfirm(): PendingConfirm | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => pending,
  );
}
