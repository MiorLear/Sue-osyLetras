import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { GradientHeader } from '@/components/gradient-header';
import { Icon, IconName } from '@/components/icon';
import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { colors } from '@/constants/theme';

const proximamente = () => Alert.alert('Próximamente disponible');

const DESCARGABLES = ['Plantillas', 'Fichas de trabajo', 'Materiales de apoyo', 'Herramientas para facilitación'];

const BIBLIOGRAFIA = [
  'El cerebro del niño — Daniel J. Siegel y Tina Payne Bryson',
  'Educar las emociones — Mireia Cabero',
  'Emocionario — Cristina Núñez Pereira',
  'La inteligencia emocional — Daniel Goleman',
];

function SectionCard({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.border,
        gap: 12,
      }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark }}>{title}</Text>
          {subtitle ? (
            <Text style={{ marginTop: 3, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function ActionButton({ label, icon }: { label: string; icon: IconName }) {
  return (
    <Pressable
      onPress={proximamente}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: colors.brand,
      }}>
      <Icon name={icon} size={14} color="#fff" strokeWidth={2.2} />
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function CajaDeHerramientasScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader paddingTop={insets.top + 16} paddingBottom={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={40} />
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Sueños y Letras</Text>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Caja de herramientas docente</Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
          Encuentra materiales prácticos para implementar la metodología ExplorArte y fortalecer el
          bienestar emocional en tu comunidad educativa.
        </Text>

        <VideoPlaceholder caption="Video de introducción – Cómo usar los recursos disponibles (~1 minuto)" />

        <SectionCard emoji="📖" title="Manual ExplorArte" subtitle="Documento principal de la metodología.">
          <ActionButton label="Descargar" icon="download" />
        </SectionCard>

        <SectionCard emoji="📋" title="Guías de actividades" subtitle="Materiales complementarios para docentes.">
          <ActionButton label="Ver guías" icon="file-text" />
        </SectionCard>

        <SectionCard emoji="📥" title="Recursos descargables">
          <View style={{ gap: 8 }}>
            {DESCARGABLES.map((item) => (
              <View
                key={item}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.bg,
                  borderWidth: 1.5,
                  borderColor: colors.borderSoft,
                }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark }}>{item}</Text>
                <Pressable
                  onPress={proximamente}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 9,
                    backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: colors.brand,
                  }}>
                  <Icon name="download" size={13} color={colors.brand} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>Descargar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          emoji="📚"
          title="Bibliografía recomendada"
          subtitle="Selección de lecturas para profundizar en bienestar emocional, desarrollo socioemocional y educación.">
          <View style={{ gap: 8 }}>
            {BIBLIOGRAFIA.map((b) => (
              <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="book-open" size={15} color={colors.brand} />
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>{b}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
