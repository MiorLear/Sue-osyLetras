import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
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
