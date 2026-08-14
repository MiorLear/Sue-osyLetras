import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { searchPlaces } from '@explorarte/shared';
import { Icon, type IconName } from './Icon';

export function PrimaryButton({
  label,
  onClick,
  disabled,
  type = 'button',
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className="btn btn-primary" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export function OutlineButton({
  label,
  onClick,
  icon,
  rightIcon,
}: {
  label: string;
  onClick?: () => void;
  icon?: IconName;
  rightIcon?: IconName;
}) {
  return (
    <button type="button" className="btn btn-outline" onClick={onClick} style={{ paddingBlock: 12 }}>
      {icon ? <Icon name={icon} size={15} color="var(--brand)" /> : null}
      {label}
      {rightIcon ? <Icon name={rightIcon} size={14} color="var(--brand)" /> : null}
    </button>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  icon?: IconName;
  password?: boolean;
  onChangeText?: (v: string) => void;
}

export function Field({ label, icon, password, onChangeText, ...rest }: FieldProps) {
  const [hidden, setHidden] = useState(true);
  return (
    <div>
      {label ? <label className="field-label">{label}</label> : null}
      <div className="field-wrap">
        {icon ? (
          <span className="field-icon">
            <Icon name={icon} size={16} color="var(--text-muted)" />
          </span>
        ) : null}
        <input
          className={'input' + (icon ? ' has-icon' : '')}
          style={password ? { paddingRight: 44 } : undefined}
          type={password ? (hidden ? 'password' : 'text') : rest.type ?? 'text'}
          onChange={(e) => onChangeText?.(e.target.value)}
          {...rest}
        />
        {password ? (
          <button type="button" className="field-toggle" onClick={() => setHidden((h) => !h)} aria-label="Mostrar contraseña">
            <Icon name={hidden ? 'eye-off' : 'eye'} size={16} color="var(--text-muted)" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Select({
  label,
  icon,
  value,
  placeholder = 'Selecciona una opción',
  options,
  onChange,
}: {
  label?: string;
  icon?: IconName;
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      {label ? <label className="field-label">{label}</label> : null}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon ? (
          <span style={{ position: 'absolute', left: 14, zIndex: 1, pointerEvents: 'none', display: 'flex' }}>
            <Icon name={icon} size={16} color="var(--text-muted)" />
          </span>
        ) : null}
        <select
          className="select-native"
          style={{ paddingLeft: icon ? 40 : 16, color: value ? 'var(--text-dark)' : 'var(--text-muted)' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const ADD_NEW_LABEL = '➕ Agregar nueva…';

/**
 * Desplegable de opciones con la posibilidad de "Agregar nueva…": al elegir esa
 * opción se cambia a un campo de texto libre. El valor escrito se guarda igual
 * que cualquier opción (se reutiliza para los KPIs).
 */
export function SelectOrAdd({
  label,
  icon,
  value,
  placeholder,
  options,
  onChange,
  addLabel = ADD_NEW_LABEL,
  newPlaceholder = 'Escribe el nombre',
}: {
  label?: string;
  icon?: IconName;
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (v: string) => void;
  addLabel?: string;
  newPlaceholder?: string;
}) {
  const [adding, setAdding] = useState(() => !!value && !options.includes(value));

  if (adding) {
    return (
      <div>
        <Field label={label} icon={icon} placeholder={newPlaceholder} value={value} autoFocus onChangeText={onChange} />
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            onChange('');
          }}
          style={{ marginTop: 6, fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>
          ← Elegir de la lista
        </button>
      </div>
    );
  }

  return (
    <Select
      label={label}
      icon={icon}
      value={options.includes(value) ? value : ''}
      placeholder={placeholder}
      options={[...options, addLabel]}
      onChange={(v) => (v === addLabel ? setAdding(true) : onChange(v))}
    />
  );
}

/**
 * Autocompletado de ubicación (tipo Google Maps) con una API gratuita y sin key.
 * Permite además texto libre: lo que se escribe se guarda aunque no se elija una
 * sugerencia. Ver shared/src/geo/places.ts.
 */
export function LocationAutocomplete({
  label,
  icon = 'map-pin',
  value,
  placeholder = 'Busca tu ubicación',
  onChange,
}: {
  label?: string;
  icon?: IconName;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  // Arranca en true para saltar la corrida del montaje: query inicia con `value`
  // (p. ej. "San Salvador"), y sin esto el efecto de abajo buscaría y abriría el
  // dropdown solo al entrar a la pantalla.
  const skip = useRef(true);

  // Si el valor cambia desde afuera (p. ej. al cargar el perfil), sincroniza sin
  // disparar una búsqueda automática.
  useEffect(() => {
    if (value !== query) {
      skip.current = true;
      setQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await searchPlaces(q);
      setItems(res);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const choose = (s: string) => {
    skip.current = true;
    onChange(s);
    setQuery(s);
    setItems([]);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Field
        label={label}
        icon={icon}
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onChangeText={(v) => {
          setQuery(v);
          onChange(v);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 4,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            overflow: 'hidden',
          }}>
          {items.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--text-dark)',
                background: '#fff',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}>
              <Icon name="map-pin" size={14} color="var(--text-muted)" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  style,
  borderColor = 'var(--border)',
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  borderColor?: string;
}) {
  return (
    <div className="card" style={{ borderColor, ...style }}>
      {children}
    </div>
  );
}
