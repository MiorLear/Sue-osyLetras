import { Icon } from './Icon';

/** Real inline video lightbox — reuses the global modal-backdrop/modal-card
 * styles (same ones AdminModal uses) so it looks consistent with the rest of
 * the app. Web viewing is online-only; offline caching is a mobile-only
 * requirement (per the app's stated offline goal). */
export function VideoModal({ videoUrl, onClose }: { videoUrl: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 12px 0' }}>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EEE2' }}>
            <Icon name="x" size={16} color="var(--text-muted)" />
          </button>
        </div>
        <video
          src={videoUrl}
          controls
          autoPlay
          style={{ width: '100%', display: 'block', borderRadius: '0 0 16px 16px', background: '#000' }}
        />
      </div>
    </div>
  );
}
