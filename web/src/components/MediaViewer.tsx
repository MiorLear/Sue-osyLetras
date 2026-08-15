import { useEffect, useState } from 'react';

import type { MediaItem } from '@explorarte/shared';

import { Icon } from '@/components/Icon';
import { getLocalUrl } from '@/lib/media-cache';
import { iconFor, mediaKind } from '@/lib/media-format';
import { canShareFiles, openFile, saveFile, shareFile } from '@/lib/open-file';
import { useIsOnline } from '@/lib/useNetworkStatus';

// El visor de archivos dentro de la app. Sustituye a VideoModal, que hacía lo
// mismo para un solo tipo — y cuya cabecera aún decía que ver contenido en web
// era necesariamente online, algo que dejó de ser cierto con PWA-2.7/2.8.
//
// Reproduce por la URL LOCAL que devuelve media-cache (que es la canónica, no
// un blob:) para que sea el service worker quien responda: así funciona sin
// conexión y, sobre todo, las peticiones Range siguen llegando al worker y el
// video se puede adelantar. Un blob: rompería el adelantado.
//
// EL PDF EN iOS SE ABRE EN UNA PESTAÑA, no se renderiza aquí (PWA-2.9 pedía
// decidirlo y dejarlo escrito). Safari en iOS no pinta un PDF dentro de un
// iframe: enseña la primera página o nada. La alternativa era empaquetar
// pdf.js, que pesa más que todo el bundle actual (417 KB) justo mientras
// SCALE-07 —sacar el CMS del bundle de las docentes— sigue abierto. Con el
// archivo cacheado, la pestaña la sirve el worker y abre igual sin conexión.

export interface MediaViewerProps {
  item: MediaItem;
  onClose: () => void;
}

export function MediaViewer({ item, onClose }: MediaViewerProps) {
  const online = useIsOnline();
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const kind = mediaKind(item.mimeType);
  const shareable = canShareFiles();

  useEffect(() => {
    let active = true;
    void (async () => {
      const local = await getLocalUrl(item.id);
      if (!active) return;
      // Con copia local se usa esa; con red, la remota; sin ninguna de las dos,
      // null y el cuerpo lo explica en vez de dejar un hueco negro.
      setSrc(local ?? (online ? item.url : null));
    })();
    return () => {
      active = false;
    };
  }, [item.id, item.url, online]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 720 }}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onClick={(e) => e.stopPropagation()}>
        <div className="media-viewer__head">
          <span className="media-viewer__title">{item.title}</span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="media-viewer__close"
            type="button">
            <Icon name="x" size={16} color="var(--text-muted)" />
          </button>
        </div>

        <div className="media-viewer__body">
          {src === undefined ? (
            <p className="media-viewer__note">Abriendo…</p>
          ) : src === null ? (
            <div className="media-viewer__placeholder">
              <span aria-hidden="true" style={{ fontSize: 34 }}>
                📡
              </span>
              <p className="media-viewer__note">
                Sin conexión, y este archivo todavía no está guardado en este dispositivo.
              </p>
              <p className="media-viewer__hint">
                Ábrelo una vez con internet y quedará disponible sin conexión.
              </p>
            </div>
          ) : kind === 'video' ? (
            <video src={src} controls autoPlay className="media-viewer__player" />
          ) : kind === 'audio' ? (
            <audio src={src} controls autoPlay className="media-viewer__audio" />
          ) : kind === 'image' ? (
            <img src={src} alt={item.title} className="media-viewer__image" />
          ) : (
            <div className="media-viewer__placeholder">
              <Icon name={iconFor(item.mimeType)} size={34} color="var(--brand)" />
              <p className="media-viewer__note">{item.title}</p>
              <button
                type="button"
                className="media-viewer__action media-viewer__action--primary"
                disabled={busy}
                onClick={() => act(() => openFile(item, online))}>
                Abrir
              </button>
            </div>
          )}
        </div>

        <div className="media-viewer__actions">
          <button
            type="button"
            className="media-viewer__action"
            disabled={busy}
            onClick={() => act(() => saveFile(item, online))}>
            <Icon name="download" size={15} color="var(--brand-dark)" /> Guardar
          </button>
          {shareable ? (
            <button
              type="button"
              className="media-viewer__action"
              disabled={busy}
              onClick={() => act(() => shareFile(item, online))}>
              <Icon name="send" size={15} color="var(--brand-dark)" /> Compartir
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
