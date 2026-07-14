import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { Field, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { OtpInput } from './register';

type Tab = 'email' | 'phone';
type Step = 'input' | 'otp' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('email');
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goLogin = () => router.push('/login');
  const isPhone = tab === 'phone';
  const canSend = isPhone ? identifier.length >= 8 : identifier.includes('@');

  const switchTab = (t: Tab) => {
    setTab(t);
    setIdentifier('');
    setError(null);
  };

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.requestOtp(identifier);
      setStep('otp');
    } catch {
      setError('No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.checkOtp(identifier, otp);
      setStep('password');
    } catch {
      setError('Código incorrecto. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(identifier, otp, password);
      setStep('success');
    } catch {
      setError('No se pudo restablecer la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Pressable onPress={goLogin} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="arrow-left" size={18} color={colors.textBody} />
          <Text style={{ color: colors.textBody, fontSize: 13, fontWeight: '600' }}>
            Volver al inicio de sesión
          </Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 }}>
        <Logo size={48} />
        <Text style={{ marginTop: 12, fontSize: 19, fontWeight: '800', color: colors.textDark }}>
          Recuperar contraseña
        </Text>
        <Text style={{ marginTop: 4, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
          Te ayudamos a recuperar el acceso a tu cuenta
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {step === 'input' ? (
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#E8F8F7' }}>
            <TabBtn label="Por correo" icon="mail" active={!isPhone} onPress={() => switchTab('email')} />
            <TabBtn label="Por teléfono" icon="phone" active={isPhone} onPress={() => switchTab('phone')} />
          </View>
        ) : null}

        {/* Step: identifier input */}
        {step === 'input' ? (
          <>
            <InfoBox
              text={
                isPhone
                  ? 'Ingresa tu número de teléfono y te enviaremos un código de 6 dígitos para verificar tu identidad.'
                  : 'Ingresa el correo con el que te registraste y te enviaremos un código de 6 dígitos para restablecer tu contraseña.'
              }
            />
            <Field
              label={isPhone ? 'Número de teléfono' : 'Correo electrónico'}
              icon={isPhone ? 'phone' : 'mail'}
              placeholder={isPhone ? '+502 1234 5678' : 'correo@ejemplo.com'}
              keyboardType={isPhone ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              value={identifier}
              onChangeText={setIdentifier}
            />
            {error ? <ErrorText text={error} /> : null}
            <PrimaryButton
              label={loading ? 'Enviando...' : 'Enviar código'}
              onPress={sendCode}
              disabled={!canSend || loading}
            />
          </>
        ) : null}

        {/* Step: OTP */}
        {step === 'otp' ? (
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
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{identifier}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDark }}>Código de 6 dígitos</Text>
            <OtpInput value={otp} onChange={setOtp} />
            {__DEV__ ? (
              <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center' }}>
                Modo prueba: el código es 123456
              </Text>
            ) : null}
            {error ? <ErrorText text={error} /> : null}
            <PrimaryButton
              label={loading ? 'Verificando...' : 'Verificar código'}
              onPress={verifyCode}
              disabled={otp.length < 6 || loading}
            />
            <Pressable onPress={sendCode} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                ¿No recibiste el código?{' '}
                <Text style={{ color: colors.brand, fontWeight: '700' }}>Reenviar</Text>
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* Step: new password */}
        {step === 'password' ? (
          <>
            <InfoBox text="Crea una nueva contraseña para tu cuenta." />
            <Field
              label="Nueva contraseña"
              password
              placeholder="Mínimo 6 caracteres"
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
            {error ? <ErrorText text={error} /> : null}
            <PrimaryButton
              label={loading ? 'Guardando...' : 'Guardar contraseña'}
              onPress={submitNewPassword}
              disabled={!password || !confirm || loading}
            />
          </>
        ) : null}

        {/* Step: success */}
        {step === 'success' ? (
          <>
            <SuccessBox
              emoji="✅"
              title="¡Contraseña actualizada!"
              text="Ya puedes iniciar sesión con tu nueva contraseña."
            />
            <PrimaryButton label="Ir al inicio de sesión" onPress={goLogin} />
          </>
        ) : null}

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  return <Text style={{ fontSize: 12.5, color: '#E53E3E', textAlign: 'center' }}>{text}</Text>;
}

function TabBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: 'mail' | 'phone';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: active ? '#fff' : 'transparent',
        ...(active ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : null),
      }}>
      <Icon name={icon} size={14} color={active ? colors.textDark : colors.textMuted} />
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: active ? '700' : '500',
          color: active ? colors.textDark : colors.textMuted,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: '#F0FFFE',
        borderWidth: 1,
        borderColor: '#C0E8E5',
      }}>
      <Text style={{ fontSize: 12.5, color: colors.textBody, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

function SuccessBox({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#F0FFF8',
        borderWidth: 1.5,
        borderColor: '#C6F6D5',
      }}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 8 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}
