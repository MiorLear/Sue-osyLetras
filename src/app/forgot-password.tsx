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

type Step = 'input' | 'otp' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goLogin = () => router.push('/login');
  const canSend = identifier.includes('@');

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(identifier);
      setStep('otp');
    } catch {
      setError('No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // El codigo se comprueba al restablecer: /auth/reset-password lo valida y
  // consume en la misma llamada, asi que aqui solo se avanza de paso.
  const verifyCode = () => {
    setError(null);
    setStep('password');
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
        {/* Step: identifier input */}
        {step === 'input' ? (
          <>
            <InfoBox text="Ingresa el correo con el que te registraste y te enviaremos un código de 6 dígitos para restablecer tu contraseña." />
            <Field
              label="Correo electrónico"
              icon="mail"
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
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
                Modo prueba: el código llega por correo (o en el log del servidor)
              </Text>
            ) : null}
            {error ? <ErrorText text={error} /> : null}
            <PrimaryButton
              label="Continuar"
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
