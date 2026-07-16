import { useRef, useState, type ReactNode } from 'react';
import type { MediaCategory, MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';

/** Modal shell reusing the global .modal-backdrop / .modal-card styles. */
export function AdminModal({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--admin" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EEE2' }}>
            <Icon name="x" size={16} color="var(--text-muted)" />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        {footer ? <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

/** Editable list of plain strings (rows with add / remove). */
export function StringListEditor({ label, items, onChange, placeholder }: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const setAt = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div>
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" value={item} placeholder={placeholder} onChange={(e) => setAt(i, e.target.value)} />
            <button onClick={() => removeAt(i)} aria-label="Eliminar" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
              <Icon name="trash" size={15} color="var(--danger)" />
            </button>
          </div>
        ))}
        <button onClick={add} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 }}>
          <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** Single file upload slot — a hidden <input type="file"> behind a styled
 * button. Uploads immediately on selection (not on save) so large files get
 * their own progress/error feedback instead of silently riding along with
 * the rest of the form's JSON PUT. */
/** Max upload size — the API's host (Render free tier) rejects larger request
 * bodies, so we guard client-side with a clear message instead of a cryptic
 * failed upload. Videos should be compressed (e.g. 720p) to fit. */
const MAX_UPLOAD_MB = 33;

export function FileUploadInput({ label, item, category, accept, onChange }: {
  label: string;
  item: MediaItem | null;
  category: MediaCategory;
  accept?: string;
  onChange: (item: MediaItem | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`El archivo pesa ${formatBytes(file.size)}. El máximo es ~${MAX_UPLOAD_MB} MB — comprímelo (p. ej. a 720p) e intenta de nuevo.`);
      return;
    }
    setUploading(true);
    setError(null);
    // Retry transient failures (the free-tier API occasionally drops large
    // uploads under memory pressure) before giving up.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const uploaded = await api.media.upload(file, file.name, category);
        onChange(uploaded);
        setUploading(false);
        return;
      } catch {
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    setError('No se pudo subir el archivo. Intenta de nuevo.');
    setUploading(false);
  };

  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {item ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#F4EEE2', border: '1px solid var(--border-input)' }}>
          <Icon name="file-text" size={16} color="var(--brand-dark)" />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </span>
          {item.sizeBytes ? (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatBytes(item.sizeBytes)}</span>
          ) : null}
          <button onClick={() => onChange(null)} aria-label="Quitar" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
            <Icon name="x" size={14} color="var(--danger)" />
          </button>
        </div>
      ) : (
        <button
          onClick={pick}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700, opacity: uploading ? 0.6 : 1 }}>
          <Icon name={uploading ? 'loader' : 'upload'} size={15} color="var(--brand-dark)" />
          {uploading ? 'Subiendo…' : 'Subir archivo'}
        </button>
      )}
      {error ? <p style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}

/** List of file-upload slots (add/remove rows), mirroring StringListEditor's
 * shape but each row is a real uploaded MediaItem instead of free text. */
export function MediaListEditor({ label, items, category, accept, onChange }: {
  label: string;
  items: MediaItem[];
  category: MediaCategory;
  accept?: string;
  onChange: (items: MediaItem[]) => void;
}) {
  const setAt = (i: number, item: MediaItem | null) =>
    onChange(item ? items.map((x, idx) => (idx === i ? item : x)) : items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { id: '', title: '', url: '', mimeType: '', sizeBytes: 0 }]);

  return (
    <div>
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <FileUploadInput
            key={i}
            label=""
            item={item.url ? item : null}
            category={category}
            accept={accept}
            onChange={(next) => setAt(i, next)}
          />
        ))}
        <button onClick={add} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 }}>
          <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar
        </button>
      </div>
    </div>
  );
}

/** Solid / outline / danger modal action button. */
export function AdminBtn({ label, onClick, variant = 'primary', disabled }: {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--brand-dark)', color: '#fff', border: 'none' },
    danger: { background: 'var(--danger)', color: '#fff', border: 'none' },
    outline: { background: '#fff', color: 'var(--brand-dark)', border: '1.5px solid var(--border-input)' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ flex: 1, padding: 12, borderRadius: 12, fontSize: 13.5, fontWeight: 700, opacity: disabled ? 0.5 : 1, ...styles[variant] }}>
      {label}
    </button>
  );
}
