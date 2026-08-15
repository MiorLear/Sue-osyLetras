import { useState } from 'react';
import type { MediaItem } from '@explorarte/shared';
import { Icon } from './Icon';
import { MediaViewer } from './MediaViewer';

/** `video` is null until an admin uploads a real intro video for this screen
 * (via /admin/videos-intro) — hide the placeholder entirely rather than show
 * a broken/empty state.
 *
 * Toma el MediaItem entero y no solo su URL porque el visor necesita el id
 * para buscar la copia local: con solo la URL, el video de bienvenida sería lo
 * único de la app que no se puede ver sin conexión. */
export function VideoPlaceholder({ caption, video }: { caption: string; video: MediaItem | null }) {
  const [open, setOpen] = useState(false);

  if (!video) return null;

  return (
    <>
      <button type="button" className="video-ph pressable" onClick={() => setOpen(true)}>
        <span className="play">
          <Icon name="play" size={22} fill="#fff" color="#fff" />
        </span>
        <span className="cap">{caption}</span>
      </button>
      {open ? <MediaViewer item={video} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
