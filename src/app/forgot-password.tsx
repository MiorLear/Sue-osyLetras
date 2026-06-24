import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { Field, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { OtpInput } from './register';

type Tab = 'email' | 'phone';
type PhoneStep = 'number' | 'otp' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('email');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number');

  const goLogin = () => router.push('/login');
  const showTabs = !emailSent && phoneStep !== 'success';

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
        {showTabs ? (
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#E8F8F7' }}>
            <TabBtn label="Por correo" icon="mail" active={tab === 'email'} onPress={() => setTab('email')} />
            <TabBtn label="Por teléfono" icon="phone" active={tab === 'phone'} onPress={() => setTab('phone')} />
          </View>
        ) : null}

        {/* Email form */}
        {tab === 'email' && !emailSent ? (
          <>
            <InfoBox text="Ingresa el correo electrónico con el que te registraste y te enviaremos un enlace para restablecer tu contraseña." />
            <Field
              label="Correo electrónico"
              icon="mail"
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <PrimaryButton
              label="Enviar enlace de recuperación"
              onPress={() => setEmailSent(true)}
              disabled={!email.includes('@')}
            />
          </>
        ) : null}

        {/* Email success */}
        {tab === 'email' && emailSent ? (
          <>
            <SuccessBox
              emoji="📬"
              title="¡Correo enviado!"
              text={`Revisa tu bandeja de entrada en ${email}. Te enviamos un enlace para restablecer tu contraseña.`}
            />
            <PrimaryButton label="Volver al inicio de sesión" onPress={goLogin} />
          </>
        ) : null}

        {/* Phone number */}
        {tab === 'phone' && phoneStep === 'number' ? (
          <>
            <InfoBox text="Ingresa tu número de teléfono y te enviaremos un código de 6 dígitos para verificar tu identidad." />
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

        {/* Phone otp */}
        {tab === 'phone' && phoneStep === 'otp' ? (
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
            <PrimaryButton
              label="Verificar código"
              onPress={() => setPhoneStep('success')}
              disabled={otp.length < 6}
            />
            <Pressable onPress={() => setPhoneStep('number')} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                ¿No recibiste el código?{' '}
                <Text style={{ color: colors.brand, fontWeight: '700' }}>Reenviar</Text>
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* Phone success */}
        {tab === 'phone' && phoneStep === 'success' ? (
          <>
            <SuccessBox
              emoji="✅"
              title="¡Identidad verificada!"
              text="Puedes ingresar una nueva contraseña para tu cuenta."
            />
            <PrimaryButton label="Volver al inicio de sesión" onPress={goLogin} />
          </>
        ) : null}

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
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
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20, textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}
