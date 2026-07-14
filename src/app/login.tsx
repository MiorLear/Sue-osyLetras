import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleIcon, Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { Field, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api, setAuthToken } from '@/lib/api';

type View_ = 'main' | 'phone-number' | 'phone-otp';

const TITLES: Record<View_, string> = {
  main: 'Bienvenida de nuevo',
  'phone-number': 'Ingresa tu teléfono',
  'phone-otp': 'Verificar número',
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showBack = view !== 'main';
  const subtitle =
    view === 'main'
      ? 'Sueños y Letras · más letras, más libres'
      : view === 'phone-number'
        ? 'Te enviaremos un código de 6 dígitos'
        : 'Código enviado a ' + phone;

  const goHome = () => router.replace('/main');

  const handleEmailLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login({ email, password });
      await setAuthToken(result.token);
      goHome();
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.requestOtp(phone);
      setView('phone-otp');
    } catch {
      setError('No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.verifyOtp(phone, otp);
      await setAuthToken(result.token);
      goHome();
    } catch {
      setError('Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showBack ? (
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
          <Pressable
            onPress={() => setView('main')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="arrow-left" size={18} color={colors.textBody} />
            <Text style={{ color: colors.textBody, fontSize: 13, fontWeight: '600' }}>Volver</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View
          style={{
            alignItems: 'center',
            paddingTop: showBack ? 16 : insets.top + 48,
            marginBottom: 24,
          }}>
          <Logo size={56} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 21,
              fontWeight: '800',
              color: colors.textDark,
              textAlign: 'center',
            }}>
            {TITLES[view]}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
            {subtitle}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {view === 'main' ? (
            <>
              <SocialButton
                icon="google"
                label="Continuar con Google"
                onPress={() =>
                  Alert.alert(
                    'Próximamente',
                    'El inicio de sesión con Google estará disponible muy pronto. Por ahora usa tu correo o teléfono.',
                  )
                }
              />
              <SocialButton
                icon="phone"
                label="Continuar con teléfono"
                onPress={() => setView('phone-number')}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderInput }} />
                <Text style={{ fontSize: 11.5, color: colors.textMuted }}>o con correo</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderInput }} />
              </View>

              <Field
                label="Correo electrónico"
                icon="mail"
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <Field
                label="Contraseña"
                password
                placeholder="Tu contraseña"
                value={password}
                onChangeText={setPassword}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable onPress={() => router.push('/forgot-password')}>
                  <Text style={{ fontSize: 12, color: colors.brand, fontWeight: '600' }}>
                    ¿Olvidaste tu contraseña?
                  </Text>
                </Pressable>
              </View>
              {error ? (
                <Text style={{ fontSize: 12.5, color: '#E53E3E', textAlign: 'center' }}>{error}</Text>
              ) : null}
              <PrimaryButton
                label={loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                onPress={handleEmailLogin}
                disabled={!email || !password || loading}
              />
            </>
          ) : null}

          {view === 'phone-number' ? (
            <>
              <Field
                label="Número de teléfono"
                icon="phone"
                placeholder="+502 1234 5678"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              {__DEV__ ? (
                <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center' }}>
                  Modo prueba: usa el teléfono de un usuario de ejemplo, p. ej. +503 7000 1234
                </Text>
              ) : null}
              <PrimaryButton
                label={loading ? 'Enviando...' : 'Enviar código'}
                onPress={handleSendCode}
                disabled={phone.length < 8 || loading}
              />
            </>
          ) : null}

          {view === 'phone-otp' ? (
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
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="• • • • • •"
                placeholderTextColor="#9DB8B5"
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  textAlign: 'center',
                  borderWidth: 1.5,
                  borderColor: otp.length > 0 ? colors.brand : colors.borderInput,
                  backgroundColor: '#fff',
                  fontSize: 26,
                  fontWeight: '800',
                  color: colors.textDark,
                  letterSpacing: 12,
                }}
              />
              {__DEV__ ? (
                <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center' }}>
                  Modo prueba: el código es 123456
                </Text>
              ) : null}
              {error ? (
                <Text style={{ fontSize: 12.5, color: '#E53E3E', textAlign: 'center' }}>{error}</Text>
              ) : null}
              <PrimaryButton
                label={loading ? 'Verificando...' : 'Verificar e iniciar sesión'}
                onPress={handleVerifyOtp}
                disabled={otp.length < 6 || loading}
              />
              <Pressable onPress={handleSendCode} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  ¿No recibiste el código? <Text style={{ color: colors.brand, fontWeight: '700' }}>Reenviar</Text>
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {view === 'main' ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
              ¿No tienes cuenta?{' '}
              <Text
                style={{ color: colors.brand, fontWeight: '700' }}
                onPress={() => router.push('/register')}>
                Registrarse
              </Text>
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SocialButton({
  icon,
  label,
  onPress,
}: {
  icon: 'google' | 'phone';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.borderSoft,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      {icon === 'google' ? (
        <GoogleIcon size={22} />
      ) : (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#7C3AED',
          }}>
          <Icon name="phone" size={13} color="#fff" />
        </View>
      )}
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{label}</Text>
    </Pressable>
  );
}
