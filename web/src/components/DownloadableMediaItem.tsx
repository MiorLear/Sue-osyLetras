import { useEffect, useState } from 'react';

import type { MediaItem } from '@explorarte/shared';

import { Icon } from '@/components/Icon';
import { MediaViewer } from '@/components/MediaViewer';
import { toast } from '@/components/toast-store';
import { download, isDownloaded } from '@/lib/media-cache';
import { formatBytes, iconFor } from '@/lib/media-format';
import { reportDownloadError } from '@/lib/open-file';
import { useIsOnline } from '@/lib/useNetworkStatus';

// La fila de un archivo. Es lo que hace visible toda la caché de medios: hasta
// PWA-2.10 las pantallas pintaban <a href target="_blank">, así que no había
// forma de saber qué había guardado, ni de guardarlo a propósito, ni de abrir
// nada sin conexión.
//
// Tres estados, que son los que pide el ticket:
//   sin descargar        → botón Descargar
//   descargando          → barra con el avance real de media-cache
//   disponible offline   → se abre en el visor, sin red
//
// Descargar es SIEMPRE una acción de la usuaria, nunca un efecto de abrir la
// pantalla: son megabytes de video y PDF, y SCALE-03 existe porque la versión
// anterior se los gastaba del plan de datos sin preguntar.

type State = 'checking' | 'absent' | 'downloading' | 'ready';

export function DownloadableMediaItem({ item }: { item: MediaItem }) {
  const online = useIsOnline();
  const [state, setState] = useState<State>('checking');
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void isDownloaded(item.id).then((has) => {
      if (active) setState(has ? 'ready' : 'absent');
    });
    return () => {
      active = false;
    };
  }, [item.id]);

  const startDownload = async () => {
    if (!online) {
      toast.info(
        'Conéctate a internet para descargar este archivo; después podrás abrirlo sin conexión.',
        { title: 'Sin conexión' },
      );
      return;
    }
    setState('downloading');
    setRatio(undefined);
    try {
      await download(item.id, item.url, {
        version: String(item.sizeBytes ?? ''),
        onProgress: (p) => setRatio(p.ratio),
      });
      setState('ready');
      toast.success(`${item.title} ya está disponible sin conexión.`);
    } catch (e) {
      setState('absent');
      reportDownloadError(e);
    }
  };

  // Con copia local abre el visor; sin ella, el visor sabe explicar el caso, así
  // que también se abre en vez de dejar el toque sin respuesta.
  const primary = () => (state === 'ready' ? setViewerOpen(true) : void startDownload());

  return (
    <>
      <button
        type="button"
        className="media-row pressable"
        onClick={primary}
        disabled={state === 'downloading' || state === 'checking'}
        aria-busy={state === 'downloading'}>
        <span className="media-row__icon" aria-hidden="true">
          <Icon name={iconFor(item.mimeType)} size={17} color="var(--brand)" />
        </span>

        <span className="media-row__body">
          <span className="media-row__title">{item.title}</span>
          {state === 'ready' ? (
            <span className="media-row__meta media-row__meta--offline">
              Disponible sin conexión{item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ''}
            </span>
          ) : state === 'downloading' ? (
            <>
              <span className="media-row__meta">
                {ratio === undefined ? 'Descargando…' : `Descargando… ${Math.round(ratio * 100)}%`}
              </span>
              <span
                className={
                  ratio === undefined
                    ? 'media-row__progress media-row__progress--indeterminate'
                    : 'media-row__progress'
                }>
                <span style={ratio === undefined ? undefined : { width: `${ratio * 100}%` }} />
              </span>
            </>
          ) : (
            <span className="media-row__meta">
              {item.sizeBytes ? formatBytes(item.sizeBytes) : 'Archivo'}
            </span>
          )}
        </span>

        {state === 'ready' ? (
          <span className="media-row__cta">
            <Icon name="check-circle" size={14} color="var(--brand-dark)" /> Abrir
          </span>
        ) : state === 'downloading' ? null : (
          <span className="media-row__cta">
            <Icon name="download" size={14} color="var(--brand-dark)" /> Descargar
          </span>
        )}
      </button>

      {viewerOpen ? <MediaViewer item={item} onClose={() => setViewerOpen(false)} /> : null}
    </>
  );
}

/** Lista de archivos, para no repetir el contenedor en cada pantalla. */
export function MediaList({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="media-list">
      {items.map((m) => (
        <DownloadableMediaItem key={m.id} item={m} />
      ))}
    </div>
  );
}
