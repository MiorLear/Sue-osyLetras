import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { colors, emotionById } from '@/constants/theme';

interface EmotionContent {
  description: string;
  classroom: string;
  questions: string[];
  activities: string[];
  stories: string[];
}

const emotionData: Record<string, EmotionContent> = {
  alegria: {
    description:
      'La alegría es una emoción positiva que surge cuando algo bueno nos sucede o anticipamos algo agradable.',
    classroom: 'Puede verse en risas, energía elevada, deseos de compartir con otros.',
    questions: [
      '¿Qué cosas te hacen sentir alegría?',
      '¿Cómo compartes tu alegría con los demás?',
      '¿Puedes recordar un momento muy feliz?',
    ],
    activities: ['Dibuja un momento feliz', 'Crea un mural de cosas que te alegran', 'Comparte una buena noticia con el grupo'],
    stories: ['El Principito — Antoine de Saint-Exupéry', 'Pollyanna — Eleanor H. Porter'],
  },
  tristeza: {
    description:
      'La tristeza aparece ante una pérdida, decepción o cuando algo importante no sale como esperábamos.',
    classroom: 'Puede verse en quietud, llanto, aislamiento o falta de energía.',
    questions: [
      '¿Qué haces cuando te sientes triste?',
      '¿A quién buscas cuando estás triste?',
      '¿Qué te ayuda a sentirte mejor?',
    ],
    activities: ['Carta a un amigo que está triste', 'Rincón de la calma', 'Dibuja lo que sientes hoy'],
    stories: ['El árbol generoso — Shel Silverstein', 'La vasija agrietada (cuento popular)'],
  },
  enojo: {
    description:
      'El enojo surge cuando sentimos que algo es injusto o cuando algo importante para nosotros es amenazado.',
    classroom: 'Puede verse en tensión muscular, voz elevada, dificultad para escuchar.',
    questions: ['¿Qué te hace enojar?', '¿Qué haces con tu cuerpo cuando te enojas?', '¿Cómo te tranquilizas?'],
    activities: ['Respiración del globo', 'El semáforo de las emociones', 'Botella de la calma'],
    stories: ['¡Fernando Furioso! — Hiawyn Oram', 'Vaya rabieta — Mireille d’Allancé'],
  },
  miedo: {
    description: 'El miedo nos alerta ante situaciones de peligro real o percibido, protegiéndonos.',
    classroom: 'Puede verse en parálisis, llanto, evitar situaciones o buscar refugio.',
    questions: ['¿A qué le tienes miedo?', '¿Qué haces cuando sientes miedo?', '¿Quién te ayuda cuando tienes miedo?'],
    activities: ['Mapa de mis miedos', 'El cofre del valor', 'Dibuja un escudo protector'],
    stories: ['Donde viven los monstruos — Maurice Sendak', 'El monstruo de colores — Anna Llenas'],
  },
  frustracion: {
    description:
      'La frustración aparece cuando no podemos lograr algo que queremos o cuando nos bloqueamos.',
    classroom: 'Puede verse en rendirse rápido, reacciones impulsivas o dificultad para pedir ayuda.',
    questions: [
      '¿Cuándo te frustraste recientemente?',
      '¿Qué hiciste?',
      '¿Cómo puedes pedir ayuda cuando algo se te hace difícil?',
    ],
    activities: ['El paso a paso para no rendirme', 'Lista de pequeñas metas', 'Juego de intentarlo de nuevo'],
    stories: ['La pequeña oruga glotona — Eric Carle', 'Lo que escuchó la mariquita (cuento de constancia)'],
  },
  verguenza: {
    description:
      'La vergüenza surge cuando sentimos que hemos fallado ante los demás o que no somos suficientes.',
    classroom: 'Puede verse en evitar hablar, esconderse, no querer participar.',
    questions: [
      '¿Cuándo sentiste vergüenza?',
      '¿Qué piensas de ti mismo en ese momento?',
      '¿Qué te gustaría que los demás supieran?',
    ],
    activities: ['Mis cualidades en un espejo', 'Círculo de aprecio del grupo', 'Diario de mis logros'],
    stories: ['Orejas de mariposa — Luisa Aguilar', 'El patito feo — Hans Christian Andersen'],
  },
  decepcion: {
    description: 'La decepción ocurre cuando la realidad no cumple nuestras expectativas.',
    classroom: 'Puede verse en resignación, tristeza tranquila, o pérdida de motivación.',
    questions: ['¿Qué esperabas que pasara?', '¿Cómo te sentiste cuando no fue así?', '¿Qué aprendiste de eso?'],
    activities: ['De la expectativa al aprendizaje', 'Caja de los planes B', 'Conversación sobre intentar otra vez'],
    stories: ['Por cuatro esquinitas de nada — Jérôme Ruillier', 'El jardín curioso — Peter Brown'],
  },
  ansiedad: {
    description: 'La ansiedad es una preocupación intensa ante situaciones futuras o inciertas.',
    classroom: 'Puede verse en dificultad para concentrarse, nerviosismo, quejas físicas.',
    questions: [
      '¿Qué te preocupa mucho?',
      '¿Qué pasa en tu cuerpo cuando te sientes ansioso?',
      '¿Qué te ayuda a calmarte?',
    ],
    activities: ['Respiración 4-4-4', 'Frasco de las preocupaciones', 'Anclaje de los 5 sentidos'],
    stories: ['Tranquilos — Lemniscates', 'Respira — Inês Castel-Branco'],
  },
};

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: 18 }} />;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark }}>{children}</Text>;
}

export default function EmotionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const emotion = emotionById(id ?? '');
  const data = id ? emotionData[id] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[emotion?.color ?? colors.brand, emotion?.color ? emotion.color + 'CC' : colors.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 22, paddingHorizontal: 16, overflow: 'hidden' }}>
        <View
          style={{ position: 'absolute', top: -24, right: -24, width: 96, height: 96, borderRadius: 48, opacity: 0.2, backgroundColor: '#fff' }}
        />
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Volver</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 44 }}>{emotion?.emoji ?? '✨'}</Text>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Emoción
            </Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{emotion?.name ?? 'Emoción'}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {data ? (
          <>
            <SectionTitle>¿Qué es esta emoción?</SectionTitle>
            <Text style={{ marginTop: 8, fontSize: 13, color: colors.textBody, lineHeight: 20 }}>{data.description}</Text>

            <Divider />
            <SectionTitle>¿Cómo puede verse en el aula?</SectionTitle>
            <Text style={{ marginTop: 8, fontSize: 13, color: colors.textBody, lineHeight: 20 }}>{data.classroom}</Text>

            <Divider />
            <SectionTitle>Preguntas para conversar</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.questions.map((q) => (
                <View key={q} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: emotion?.color ?? colors.brand, fontSize: 13, fontWeight: '800' }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textBody, lineHeight: 19 }}>{q}</Text>
                </View>
              ))}
            </View>

            <Divider />
            <SectionTitle>Actividades recomendadas</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.activities.map((a) => (
                <View
                  key={a}
                  style={{
                    borderRadius: 12,
                    padding: 14,
                    backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: (emotion?.bg ?? colors.navBg),
                    }}>
                    <Icon name="edit" size={14} color={emotion?.color ?? colors.brand} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark }}>{a}</Text>
                </View>
              ))}
            </View>

            <Divider />
            <SectionTitle>Historias sugeridas</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.stories.map((s) => (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="book-open" size={15} color={emotion?.color ?? colors.brand} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textBody, lineHeight: 19 }}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 13, color: colors.textBody }}>
            No encontramos información para esta emoción.
          </Text>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
