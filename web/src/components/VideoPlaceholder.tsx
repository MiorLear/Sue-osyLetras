import { useState } from 'react';
import type { MediaItem } from '@explorarte/shared';
import { Icon } from './Icon';
import { MediaViewer } from './MediaViewer';

/**
 * El botón que abre un video de introducción.
 *
 * Toma el MediaItem entero y no solo su URL porque el visor necesita el id
 * para buscar la copia local: con solo la URL, el video de bienvenida sería lo
 * único de la app que no se puede ver sin conexión.
 *
 * Sin video del CMS y sin `fallbackUrl` no se dibuja nada: mejor que la
 * pantalla no mencione un video a que prometa uno que no existe.
 */
export function VideoPlaceholder({
  caption,
  duration,
  video,
  fallbackUrl,
}: {
  caption: string;
  /** "1 min 34 s" — lo que le cuesta a la docente si le da al play. */
  duration?: string;
  video: MediaItem | null;
  /** Copia que viaja con la app, para cuando el CMS todavía no tiene una. */
  fallbackUrl?: string;
}) {
  const [open, setOpen] = useState(false);

  // El video del CMS manda: es el que se puede reemplazar sin desplegar. El
  // archivo estático es la copia de seguridad, y se envuelve en un MediaItem
  // para que el visor sea exactamente el mismo en los dos casos.
  const item =
    video ??
    (fallbackUrl
      ? { id: `static:${fallbackUrl}`, title: caption, url: fallbackUrl, mimeType: 'video/mp4', sizeBytes: 0 }
      : null);

  if (!item) return null;

  return (
    <>
      <button type="button" className="video-ph pressable" onClick={() => setOpen(true)}>
        <span className="play">
          <Icon name="play" size={22} fill="#fff" color="#fff" />
        </span>
        <span className="cap">{caption}</span>
        {duration ? <span className="dur">⏱ {duration}</span> : null}
      </button>
      {open ? <MediaViewer item={item} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
