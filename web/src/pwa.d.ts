/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

// Ambient types for the PWA layer.

/**
 * Chromium-only event fired when the browser considers the app installable.
 * Not in lib.dom.d.ts because it is not a standard; Safari never fires it,
 * which is why `InstallPrompt` also ships the manual iOS instructions.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}

interface Navigator {
  /** Legacy iOS Safari flag: true when launched from the Home Screen. */
  readonly standalone?: boolean;
}
