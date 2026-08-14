import { useState } from 'react';
import { Icon } from './Icon';
import { VideoModal } from './VideoModal';

/** videoUrl is null until an admin uploads a real intro video for this screen
 * (via /admin/videos-intro) — hide the placeholder entirely rather than show
 * a broken/empty state. */
export function VideoPlaceholder({ caption, videoUrl }: { caption: string; videoUrl: string | null }) {
  const [open, setOpen] = useState(false);

  if (!videoUrl) return null;

  return (
    <>
      <button type="button" className="video-ph pressable" onClick={() => setOpen(true)}>
        <span className="play">
          <Icon name="play" size={22} fill="#fff" color="#fff" />
        </span>
        <span className="cap">{caption}</span>
      </button>
      {open ? <VideoModal videoUrl={videoUrl} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
