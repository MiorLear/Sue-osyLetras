import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EVENT_COLORS } from '@explorarte/shared';
import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { GradientHeader } from '@/components/gradient-header';
import { Icon, IconName } from '@/components/icon';
import { Logo } from '@/components/logo';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

interface NavCard {
  emoji: string;
  title: string;
  description: string;
  cta: string;
  ctaIcon: IconName;
  href: string;
  bg: string;
  accent: string;
}

const CARDS: NavCard[] = [
  {
    emoji: 'ℹ️',
    title: 'Sobre ExplorArte',
    description: 'Conoce más sobre la metodología y Sueños y Letras.',
    cta: 'Conocer más',
    ctaIcon: 'chevron-right',
    href: '/sobre',
    bg: '#E6F8F7',
    accent: colors.brandDark,
  },
  {
    emoji: '📚',
    title: 'Biblioteca de emociones',
    description: 'Recursos para acompañar emociones específicas en el aula.',
    cta: 'Explorar emociones',
    ctaIcon: 'book-open',
    href: '/emociones',
    bg: '#EBF8FF',
    accent: '#3182CE',
  },
  {
    emoji: '🧰',
    title: 'Caja de herramientas docente',
    description: 'Manuales, materiales descargables y herramientas prácticas.',
    cta: 'Ver herramientas',
    ctaIcon: 'download',
    href: '/herramientas',
    bg: '#FFFAF0',
    accent: '#DD6B20',
  },
  {
    emoji: '🌱',
    title: 'Aprendiendo sobre bienestar emocional',
    description: 'Conceptos y estrategias para el acompañamiento socioemocional.',
    cta: 'Explorar contenidos',
    ctaIcon: 'chevron-right',
    href: '/aprendiendo',
    bg: '#F0FFF4',
    accent: '#38A169',
  },
  {
    emoji: '💬',
    title: 'Comunidad ExplorArte',
    description: 'Comparte experiencias con otras docentes.',
    cta: 'Ver comunidad',
    ctaIcon: 'message-circle',
    href: '/comunidad',
    bg: '#F5F0FF',
    accent: '#7C3AED',
  },
];

interface DashboardEvent {
  key: string;
  group: string;
  time: string;
  label: string;
  color: string;
  urgent: boolean;
}

const fmtTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};

const minutesUntil = (dateStr: string, hhmm: string) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const target = new Date(y, mo - 1, d, h, mi).getTime();
  return Math.round((target - Date.now()) / 60000);
};

const fmtCountdown = (minutes: number) => {
  if (minutes <= 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `En ${hours}h ${rest}min` : `En ${hours}h`;
};

const fmtToday = () =>
  new Date().toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

export default function MainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAsync(async () => {
    const [profile, rawEvents] = await Promise.all([api.profile.get(), api.events.list()]);
    const upcoming: DashboardEvent[] = rawEvents
      .map((e) => ({ e, minutes: minutesUntil(e.date, e.startTime) }))
      .filter(({ minutes }) => minutes > -60)
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 3)
      .map(({ e, minutes }) => ({
        key: e.id,
        group: e.title,
        time: fmtTime12(e.startTime),
        label: fmtCountdown(minutes),
        color: EVENT_COLORS[e.type] ?? colors.brand,
        urgent: minutes <= 30,
      }));
    return { profile, events: upcoming };
  }, []);

  const firstName = data?.profile.name ?? '';
  const events = data?.events ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader paddingTop={insets.top + 16} paddingBottom={28}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={44} />
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>Sueños y Letras</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Bienvenida,</Text>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>{firstName}</Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 20 }}
        showsVerticalScrollIndicator={false}>
        {/* Explora según tu necesidad */}
        <View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 12 }}>
            Explora según tu necesidad
          </Text>
          <View style={{ gap: 12 }}>
            {CARDS.map((c) => (
              <View
                key={c.href}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  backgroundColor: c.bg,
                  borderWidth: 1.5,
                  borderColor: c.accent + '30',
                  gap: 12,
                }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 30 }}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark }}>
                      {c.title}
                    </Text>
                    <Text style={{ marginTop: 3, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>
                      {c.description}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push(c.href as never)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 11,
                    borderRadius: 12,
                    backgroundColor: c.accent,
                  }}>
                  <Icon name={c.ctaIcon} size={14} color="#fff" strokeWidth={2.2} />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{c.cta}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* Mi Calendario */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark }}>Mi Calendario</Text>
            <Text style={{ fontSize: 11, color: colors.brand, fontWeight: '600' }}>Hoy · {fmtToday()}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 32, marginBottom: 12 }} />
          ) : error ? (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
                No pudimos cargar tu calendario. Revisa tu conexión.
              </Text>
              <Pressable
                onPress={reload}
                style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                borderRadius: 16,
                backgroundColor: '#fff',
                overflow: 'hidden',
                marginBottom: 12,
                borderWidth: 1.5,
                borderColor: '#E4F4F3',
              }}>
              {events.length === 0 ? (
                <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                    No tienes eventos próximos.
                  </Text>
                </View>
              ) : (
                events.map((ev, i) => (
                  <View
                    key={ev.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderBottomWidth: i < events.length - 1 ? 1 : 0,
                      borderBottomColor: '#F0F5F5',
                    }}>
                    <View style={{ width: 4, height: 36, borderRadius: 9, backgroundColor: ev.color }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDark }}>{ev.group}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{ev.time}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="clock" size={11} color={ev.urgent ? colors.danger : colors.textMuted} />
                      <Text
                        style={{
                          fontSize: 11,
                          color: ev.urgent ? colors.danger : colors.textMuted,
                          fontWeight: ev.urgent ? '700' : '400',
                        }}>
                        {ev.label}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
          <Pressable
            onPress={() => router.push('/calendar')}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: '#fff',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1.5,
              borderColor: colors.brand,
            }}>
            <Icon name="calendar" size={14} color={colors.brand} strokeWidth={2.2} />
            <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '700' }}>Ver Calendario</Text>
            <Icon name="chevron-right" size={14} color={colors.brand} strokeWidth={2.2} />
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
