import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { brandGradient, colors } from '@/constants/theme';
import { searchPlaces } from '@/lib/places';

// Botón principal con degradado de marca y estado deshabilitado.
export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <View
        style={{
          width: '100%',
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.disabled,
          alignItems: 'center',
        }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

// Botón secundario (borde de marca, fondo blanco).
export function OutlineButton({
  label,
  onPress,
  icon,
  rightIcon,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  rightIcon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.brand,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      {icon ? <Icon name={icon} size={15} color={colors.brand} /> : null}
      <Text style={{ color: colors.brand, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      {rightIcon ? <Icon name={rightIcon} size={14} color={colors.brand} /> : null}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  password?: boolean;
}

// Campo de texto etiquetado con ícono opcional y toggle de contraseña.
export function Field({ label, icon, password, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      {label ? (
        <Text
          style={{
            marginBottom: 6,
            fontSize: 13,
            fontWeight: '700',
            color: colors.textDark,
          }}>
          {label}
        </Text>
      ) : null}
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        {icon ? (
          <View style={{ position: 'absolute', left: 14, zIndex: 1 }}>
            <Icon name={icon} size={16} color={colors.textMuted} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor="#9DB8B5"
          secureTextEntry={password ? hidden : false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              width: '100%',
              paddingVertical: 12,
              paddingLeft: icon ? 40 : 16,
              paddingRight: password ? 44 : 16,
              borderRadius: 12,
              fontSize: 14,
              color: colors.textDark,
              backgroundColor: '#fff',
              borderWidth: 1.5,
              borderColor: focused ? colors.brand : colors.borderInput,
            },
            style,
          ]}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            style={{ position: 'absolute', right: 12, padding: 2 }}>
            <Icon name={hidden ? 'eye-off' : 'eye'} size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Selector tipo dropdown (abre un modal con la lista de opciones).
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
  const [open, setOpen] = useState(false);
  return (
    <View>
      {label ? (
        <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '700', color: colors.textDark }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: icon ? 14 : 16,
          borderRadius: 12,
          backgroundColor: '#fff',
          borderWidth: 1.5,
          borderColor: value ? colors.brand : colors.borderInput,
        }}>
        {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
        <Text style={{ flex: 1, fontSize: 14, color: value ? colors.textDark : colors.textMuted }}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(20,40,38,0.45)',
            justifyContent: 'center',
            padding: 32,
          }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            {options.map((opt, i) => (
              <Pressable
                key={opt}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  backgroundColor: pressed ? colors.navBg : '#fff',
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                })}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: value === opt ? '700' : '500',
                    color: value === opt ? colors.brand : colors.textDark,
                  }}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const ADD_NEW_LABEL = '➕ Agregar nueva…';

// Desplegable con opción "Agregar nueva…": al elegirla cambia a un campo de
// texto libre. El valor escrito se guarda igual que cualquier opción.
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
      <View>
        <Field label={label} icon={icon} placeholder={newPlaceholder} value={value} autoFocus onChangeText={onChange} />
        <Pressable
          onPress={() => {
            setAdding(false);
            onChange('');
          }}
          style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: colors.brand, fontWeight: '700' }}>← Elegir de la lista</Text>
        </Pressable>
      </View>
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

// Autocompletado de ubicación (tipo Google Maps) con API gratuita y sin key.
// Permite texto libre: lo escrito se guarda aunque no se elija una sugerencia.
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
    <View>
      <Field
        label={label}
        icon={icon}
        placeholder={placeholder}
        value={query}
        autoCapitalize="words"
        onChangeText={(v) => {
          setQuery(v);
          onChange(v);
        }}
      />
      {open && items.length > 0 ? (
        <View
          style={{
            marginTop: 4,
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {items.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => choose(s)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}>
              <Icon name="map-pin" size={14} color={colors.textMuted} />
              <Text style={{ fontSize: 13, color: colors.textDark }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Tarjeta blanca redondeada reutilizable.
export function Card({
  children,
  style,
  borderColor = colors.border,
}: {
  children: ReactNode;
  style?: object;
  borderColor?: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
