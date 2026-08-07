import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
}

interface ToastOptions {
  title?: string;
  /** Milliseconds on screen. 0 keeps it until dismissed. */
  duration?: number;
}

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  // Errors are the ones a teacher actually needs to read.
  error: 7000,
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function dismissToast(id: number) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function push(tone: ToastTone, message: string, options: ToastOptions = {}): number {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message, title: options.title }];
  emit();

  const duration = options.duration ?? DEFAULT_DURATION[tone];
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

/**
 * Non-blocking replacement for `window.alert`.
 *
 * Callable from anywhere, including outside React: `window.alert` blocks the
 * main thread, cannot be styled, and behaves erratically in an installed PWA —
 * and it is where offline feedback has to land.
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => push('success', message, options),
  error: (message: string, options?: ToastOptions) => push('error', message, options),
  info: (message: string, options?: ToastOptions) => push('info', message, options),
  dismiss: dismissToast,
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test helper: drops every visible toast. */
export function clearToasts() {
  toasts = [];
  emit();
}
