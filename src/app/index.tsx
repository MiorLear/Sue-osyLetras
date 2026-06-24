import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { brandGradient, colors } from '@/constants/theme';

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
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goToLogin = () => router.push('/login');

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (index < SLIDES - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
      setIndex(index + 1);
    } else {
      goToLogin();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Barra superior: Saltar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 4,
        }}>
        <Pressable onPress={goToLogin} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Saltar</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}>
        {/* Slide 1 — Bienvenida (video) */}
        <Slide width={width}>
          <View style={{ alignItems: 'center', gap: 18 }}>
            <Logo size={64} />
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.textDark, textAlign: 'center' }}>
              Bienvenida a ExplorArte
            </Text>
            <Text style={{ fontSize: 14, color: colors.textBody, textAlign: 'center', lineHeight: 21 }}>
              Lectura, arte y emociones para construir comunidades de aprendizaje más saludables.
            </Text>
            <View style={{ width: '100%', marginTop: 4 }}>
              <VideoPlaceholder caption="Video de bienvenida del equipo de Sueños y Letras" />
            </View>
            <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center', lineHeight: 18 }}>
              Acompañamos a docentes con recursos prácticos para promover el bienestar emocional, la
              creatividad y el desarrollo socioemocional de niñas, niños y adolescentes.
            </Text>
          </View>
        </Slide>

        {/* Slide 2 — ¿Qué es ExplorArte? */}
        <Slide width={width}>
          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textDark }}>
              ¿Qué es ExplorArte?
            </Text>
            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
              ExplorArte es una metodología creada por Sueños y Letras para fortalecer la salud mental y
              el bienestar emocional en comunidades educativas a través de la lectura, el arte y
              experiencias participativas.
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDark }}>
              Trabajamos desde tres pilares fundamentales:
            </Text>
            <View style={{ gap: 12 }}>
              {PILARES.map((p) => (
                <View
                  key={p.title}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}>
                  <Text style={{ fontSize: 28 }}>{p.emoji}</Text>
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
        </Slide>

        {/* Slide 3 — ¿Cómo funciona? */}
        <Slide width={width}>
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textDark }}>¿Cómo funciona?</Text>
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
        </Slide>
      </ScrollView>

      {/* Indicadores + CTA */}
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: SLIDES }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 9,
                backgroundColor: i === index ? colors.brand : colors.borderInput,
              }}
            />
          ))}
        </View>

        <Pressable onPress={next}>
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
              {index === SLIDES - 1 ? 'Comenzar' : 'Siguiente'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={goToLogin} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Ya tengo cuenta — <Text style={{ color: colors.brand, fontWeight: '700' }}>Iniciar sesión</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Cada slide ocupa el ancho completo y permite scroll vertical si el contenido es alto.
function Slide({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}
