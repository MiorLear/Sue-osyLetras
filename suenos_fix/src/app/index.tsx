import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { brandGradient, colors } from '@/constants/theme';
import { api, authReady, hasToken } from '@/lib/api';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

const PILARES = [
  {
    emoji: '🧠',
    title: 'Salud mental',
    text: 'Promovemos herramientas que fortalecen el bienestar psicológico y emocional.',
  },
  {
    emoji: '💚',
    title: 'Desarrollo emocional',
    text: 'Facilitamos espacios para reconocer, comprender y expresar emociones de manera saludable.',
  },
  {
    emoji: '🤝',
    title: 'Desarrollo social',
    text: 'Fortalecemos habilidades que favorecen relaciones positivas y comunidades más empáticas.',
  },
];

const PASOS = [
  { n: '1', title: 'Reconocer', text: 'Comprender emociones, pensamientos y comportamientos.' },
  {
    n: '2',
    title: 'Expresar',
    text: 'Utilizar la lectura, el arte y el diálogo para expresar experiencias y emociones.',
  },
  { n: '3', title: 'Conectar', text: 'Fortalecer la empatía, la convivencia y las relaciones saludables.' },
  { n: '4', title: 'Crecer', text: 'Desarrollar herramientas para el bienestar personal y comunitario.' },
];

const SLIDES = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const { data: homeIntro } = useOfflineAsync('screen-intro:home', () => api.screenIntros.get('home'), []);
  const introVideo = homeIntro?.video ?? null;

  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    let active = true;
    authReady.then(() => {
      if (!active) return;
      if (hasToken()) router.replace('/main');
      else setAuthChecked(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const goToLogin = () => router.push('/login');
  const next = () => (index < SLIDES - 1 ? setIndex(index + 1) : goToLogin());

  if (!authChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={72} />
      </View>
    );
  }

  const horizontalPadding = Math.min(32, Math.max(18, width * 0.04));
  const contentMaxWidth = width >= 1100 ? 920 : width >= 800 ? 760 : 640;
  const compact = height < 720 || width < 420;
  const footerPaddingBottom = Math.max(16, insets.bottom + 12);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          minHeight: insets.top + 46,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          paddingTop: insets.top,
          paddingHorizontal: horizontalPadding,
          paddingBottom: 8,
        }}>
        <Pressable onPress={goToLogin} hitSlop={10} accessibilityRole="button">
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>Saltar</Text>
        </Pressable>
      </View>

      <ScrollView
        key={index}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: compact ? 12 : 18,
          paddingBottom: compact ? 18 : 26,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: contentMaxWidth }}>
          {index === 0 && (
            <View style={{ alignItems: 'center', gap: compact ? 12 : 18 }}>
              <Logo size={compact ? 54 : 64} />
              <Text
                style={{
                  fontSize: width < 420 ? 24 : 29,
                  fontWeight: '800',
                  color: colors.textDark,
                  textAlign: 'center',
                }}>
                Bienvenida a ExplorArte
              </Text>
              <Text
                style={{
                  fontSize: width < 420 ? 13.5 : 15,
                  color: colors.textBody,
                  textAlign: 'center',
                  lineHeight: width < 420 ? 20 : 22,
                  maxWidth: 680,
                }}>
                Lectura, arte y emociones para construir comunidades de aprendizaje más saludables.
              </Text>
              <View style={{ width: '100%', marginTop: 2 }}>
                <VideoPlaceholder caption="Video de bienvenida del equipo de Sueños y Letras" videoItem={introVideo} />
              </View>
              <Text
                style={{
                  fontSize: width < 420 ? 12 : 13,
                  color: colors.textMuted,
                  textAlign: 'center',
                  lineHeight: 19,
                  maxWidth: 700,
                }}>
                Acompañamos a docentes con recursos prácticos para promover el bienestar emocional, la creatividad y el
                desarrollo socioemocional de niñas, niños y adolescentes.
              </Text>
            </View>
          )}

          {index === 1 && (
            <View style={{ gap: compact ? 12 : 16 }}>
              <Text style={{ fontSize: width < 420 ? 21 : 24, fontWeight: '800', color: colors.textDark }}>
                ¿Qué es ExplorArte?
              </Text>
              <Text style={{ fontSize: 13.5, color: colors.textBody, lineHeight: 21 }}>
                ExplorArte es una metodología creada por Sueños y Letras para fortalecer la salud mental y el bienestar
                emocional en comunidades educativas a través de la lectura, el arte y experiencias participativas.
              </Text>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.textDark }}>
                Trabajamos desde tres pilares fundamentales:
              </Text>
              <View style={{ gap: 12 }}>
                {PILARES.map((p) => (
                  <View
                    key={p.title}
                    style={{
                      borderRadius: 16,
                      padding: width < 420 ? 13 : 16,
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}>
                    <Text style={{ fontSize: width < 420 ? 25 : 28 }}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textDark }}>{p.title}</Text>
                      <Text style={{ marginTop: 3, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>
                        {p.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {index === 2 && (
            <View style={{ gap: compact ? 12 : 16 }}>
              <Text style={{ fontSize: width < 420 ? 21 : 24, fontWeight: '800', color: colors.textDark }}>
                ¿Cómo funciona?
              </Text>
              <View style={{ gap: 14 }}>
                {PASOS.map((p) => (
                  <View key={p.n} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.navBg,
                        borderWidth: 1.5,
                        borderColor: 'rgba(61,191,184,0.3)',
                      }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand }}>{p.n}</Text>
                    </View>
                    <View style={{ flex: 1, paddingTop: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textDark }}>{p.title}</Text>
                      <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>
                        {p.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={{
          alignItems: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: 10,
          paddingBottom: footerPaddingBottom,
          backgroundColor: colors.bg,
        }}>
        <View style={{ width: '100%', maxWidth: contentMaxWidth, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {Array.from({ length: SLIDES }).map((_, i) => (
              <Pressable key={i} onPress={() => setIndex(i)} hitSlop={8} accessibilityRole="tab">
                <View
                  style={{
                    width: i === index ? 24 : 8,
                    height: 8,
                    borderRadius: 9,
                    backgroundColor: i === index ? colors.brand : colors.borderInput,
                  }}
                />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={next} accessibilityRole="button">
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                minHeight: 52,
                paddingHorizontal: 20,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                {index === SLIDES - 1 ? 'Comenzar' : 'Siguiente'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={goToLogin} style={{ alignItems: 'center', minHeight: 28, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              Ya tengo cuenta — <Text style={{ color: colors.brand, fontWeight: '700' }}>Iniciar sesión</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
