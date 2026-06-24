import { Icon } from './Icon';

// Mobile plays a bundled demo video; on web we keep the placeholder visual and
// show a friendly notice on click (no real video shipped with the web build).
export function VideoPlaceholder({ caption }: { caption: string }) {
  return (
    <button
      type="button"
      className="video-ph pressable"
      onClick={() => alert('Video de demostración — próximamente disponible en la web.')}>
      <span className="play">
        <Icon name="play" size={22} fill="#fff" color="#fff" />
      </span>
      <span className="cap">{caption}</span>
    </button>
  );
}
