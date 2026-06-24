import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { brandGradient, colors } from '@/constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function SobreExplorArteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 22, paddingHorizontal: 16, overflow: 'hidden' }}>
        <View
          style={{ position: 'absolute', top: -24, right: -24, width: 96, height: 96, borderRadius: 48, opacity: 0.2, backgroundColor: '#fff' }}
        />
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Volver</Text>
        </Pressable>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Sueños y Letras</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Sobre ExplorArte</Text>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Section title="¿Qué es ExplorArte?">
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
            ExplorArte es una iniciativa desarrollada por Sueños y Letras que promueve la salud mental y
            el bienestar emocional a través de la lectura, el arte y experiencias participativas de
            aprendizaje.
          </Text>
        </Section>

        <Section title="Nuestra visión">
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
            Construir comunidades educativas donde niñas, niños y adolescentes puedan desarrollarse
            plenamente, contando con herramientas emocionales que les permitan afrontar los desafíos de
            la vida y alcanzar su potencial.
          </Text>
        </Section>

        <Section title="Nuestro enfoque">
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20, marginBottom: 10 }}>
            Trabajamos desde tres pilares fundamentales:
          </Text>
          <View style={{ gap: 8 }}>
            {['Salud mental', 'Desarrollo emocional', 'Desarrollo social'].map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textDark }}>{p}</Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
            Estos pilares se fortalecen mediante la lectura, la escritura, el arte y la participación
            activa de las comunidades educativas.
          </Text>
        </Section>

        <Section title="Sueños y Letras">
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
            Sueños y Letras acompaña y promueve el bienestar socioemocional, la libertad creativa y el
            desarrollo de comunidades de aprendizaje a través de la lectura y la escritura.
          </Text>
        </Section>

        {/* Placeholder de imagen de cierre */}
        <View
          style={{
            height: 160,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#EAF4F3',
            borderWidth: 1.5,
            borderColor: colors.borderSoft,
            borderStyle: 'dashed',
          }}>
          <Icon name="image" size={34} color={colors.textMuted} />
          <Text style={{ fontSize: 11.5, color: colors.textMuted }}>Imagen de Sueños y Letras</Text>
        </View>
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
