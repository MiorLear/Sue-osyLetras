import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleIcon, Icon, IconName } from '@/components/icon';
import { Logo } from '@/components/logo';
import { Field, PrimaryButton, Select } from '@/components/ui';
import { colors, SCHOOLS } from '@/constants/theme';

type Method = 'google' | 'phone' | 'email' | null;
const TITLES = ['Crear cuenta', 'Verificar identidad', 'Tu información'];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>(null);
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [school, setSchool] = useState('');

  const goHome = () => router.replace('/main');

  const back = () => {
    if (step === 0) router.push('/login');
    else if (step === 1) {
      setStep(0);
      setMethod(null);
    } else setStep(1);
  };

  const choose = (m: Method) => {
    if (m === 'google') {
      setMethod(m);
      setStep(2);
    } else {
      setMethod(m);
      setStep(1);
      setPhoneStep('number');
    }
  };

  let subtitle = '';
  if (step === 0) subtitle = 'Elige cómo quieres registrarte';
  else if (step === 1 && method === 'email') subtitle = 'Ingresa tu correo y contraseña';
  else if (step === 1 && method === 'phone')
    subtitle = phoneStep === 'number' ? 'Ingresa tu número de teléfono' : 'Ingresa el código que recibiste';
  else if (step === 2) subtitle = 'Cuéntanos un poco sobre ti';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar con dots de progreso */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
        }}>
        <Pressable
          onPress={back}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.borderInput,
          }}>
          <Icon name="arrow-left" size={18} color={colors.textBody} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === step ? 16 : 6,
                height: 6,
                borderRadius: 9,
                backgroundColor: i <= step ? colors.brand : colors.borderInput,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 }}>
        <Logo size={56} />
        <Text style={{ marginTop: 12, fontSize: 21, fontWeight: '800', color: colors.textDark }}>
          {TITLES[step]}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
          {subtitle}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* STEP 0 */}
        {step === 0 ? (
          <>
            <MethodCard
              iconBg="#FFF3E0"
              title="Continuar con Google"
              subtitle="Usa tu cuenta de Google"
              onPress={() => choose('google')}
              google
            />
            <MethodCard
              iconBg="#F5F0FF"
              iconColor="#7C3AED"
              icon="phone"
              title="Número de teléfono"
              subtitle="Recibirás un código de verificación"
              onPress={() => choose('phone')}
            />
            <MethodCard
              iconBg="#E8F8F7"
              iconColor={colors.brand}
              icon="mail"
              title="Correo y contraseña"
              subtitle="Crea tu cuenta con email"
              onPress={() => choose('email')}
            />
          </>
        ) : null}

        {/* STEP 1 — email */}
        {step === 1 && method === 'email' ? (
          <>
            <Field
              label="Correo electrónico"
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              label="Contraseña"
              password
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChangeText={setPassword}
            />
            <Field
              label="Confirmar contraseña"
              password
              placeholder="Repite tu contraseña"
              value={confirm}
              onChangeText={setConfirm}
            />
            <PrimaryButton
              label="Siguiente"
              onPress={() => setStep(2)}
              disabled={!email || !password || password !== confirm}
            />
          </>
        ) : null}

        {/* STEP 1 — phone number */}
        {step === 1 && method === 'phone' && phoneStep === 'number' ? (
          <>
            <Field
              label="Número de teléfono"
              icon="phone"
              placeholder="+502 1234 5678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <PrimaryButton
              label="Enviar código"
              onPress={() => setPhoneStep('otp')}
              disabled={phone.length < 8}
            />
          </>
        ) : null}

        {/* STEP 1 — phone otp */}
        {step === 1 && method === 'phone' && phoneStep === 'otp' ? (
          <>
            <View
              style={{
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
                backgroundColor: '#E8F8F7',
                borderWidth: 1,
                borderColor: '#C0E8E5',
              }}>
              <Text style={{ fontSize: 12.5, color: colors.textBody }}>Código enviado a</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{phone}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDark }}>
              Código de 6 dígitos
            </Text>
            <OtpInput value={otp} onChange={setOtp} />
            <PrimaryButton label="Verificar código" onPress={() => setStep(2)} disabled={otp.length < 6} />
            <Pressable onPress={() => setPhoneStep('number')} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                ¿No recibiste el código?{' '}
                <Text style={{ color: colors.brand, fontWeight: '700' }}>Reenviar</Text>
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* STEP 2 — info */}
        {step === 2 ? (
          <>
            {method === 'google' ? (
              <View
                style={{
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#F0FFF4',
                  borderWidth: 1,
                  borderColor: '#C6F6D5',
                }}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={{ fontSize: 12.5, color: '#276749', fontWeight: '600' }}>
                  Google conectado correctamente
                </Text>
              </View>
            ) : null}
            <Field label="Nombre" icon="user" placeholder="María" value={name} onChangeText={setName} />
            <Field
              label="Apellido"
              icon="user"
              placeholder="García"
              value={lastname}
              onChangeText={setLastname}
            />
            <Select
              label="Colegio / Ubicación"
              icon="map-pin"
              placeholder="Selecciona tu colegio"
              value={school}
              options={SCHOOLS}
              onChange={setSchool}
            />
            <PrimaryButton
              label="Crear cuenta"
              onPress={goHome}
              disabled={!name || !lastname || !school}
            />
          </>
        ) : null}

        <View style={{ height: 8 }} />
      </ScrollView>

      <View style={{ paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center' }}>
        <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
          ¿Ya tienes cuenta?{' '}
          <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={() => router.push('/login')}>
            Iniciar sesión
          </Text>
        </Text>
      </View>
    </View>
  );
}

function MethodCard({
  iconBg,
  iconColor,
  icon,
  google,
  title,
  subtitle,
  onPress,
}: {
  iconBg: string;
  iconColor?: string;
  icon?: IconName;
  google?: boolean;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.borderSoft,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
        }}>
        {google ? <GoogleIcon size={22} /> : <Icon name={icon!} size={22} color={iconColor} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>{subtitle}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      maxLength={6}
      placeholder="• • • • • •"
      placeholderTextColor="#9DB8B5"
      style={{
        paddingVertical: 16,
        borderRadius: 12,
        textAlign: 'center',
        borderWidth: 1.5,
        borderColor: value.length > 0 ? colors.brand : colors.borderInput,
        backgroundColor: '#fff',
        fontSize: 23,
        fontWeight: '800',
        color: colors.textDark,
        letterSpacing: 12,
      }}
    />
  );
}
