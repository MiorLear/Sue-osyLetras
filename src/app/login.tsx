import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleIcon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { Field, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api, setAuthToken, usingMock } from '@/lib/api';
import { showNotice } from '@/lib/notice';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: insets.top + 48, marginBottom: 24 }}>
          <Logo size={56} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 21,
              fontWeight: '800',
              color: colors.textDark,
              textAlign: 'center',
            }}>
            Bienvenida de nuevo
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
            Sueños y Letras · más letras, más libres
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {usingMock ? (
            <View
              accessibilityRole="alert"
              style={{ padding: 12, borderRadius: 12, backgroundColor: '#FFF4CC' }}>
              <Text style={{ color: '#76520B', fontSize: 12.5, fontWeight: '700', textAlign: 'center' }}>
                Modo demostración activo · los datos y accesos no son reales
              </Text>
            </View>
          ) : null}

          <SocialButton
            label="Continuar con Google"
            onPress={() =>
              showNotice(
                'Próximamente',
                'El inicio de sesión con Google estará disponible muy pronto. Por ahora usa tu correo.',
              )
            }
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
        </View>

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
      </ScrollView>
    </View>
  );
}

function SocialButton({ label, onPress }: { label: string; onPress: () => void }) {
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
      <GoogleIcon size={22} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{label}</Text>
    </Pressable>
  );
}
