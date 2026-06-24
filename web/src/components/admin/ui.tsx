import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

/** Modal shell reusing the global .modal-backdrop / .modal-card styles. */
export function AdminModal({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
