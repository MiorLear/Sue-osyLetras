import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { GradientHeader } from '@/components/gradient-header';
import { Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { colors } from '@/constants/theme';

interface SubTopic {
  title: string;
  body: string;
}
interface Topic {
  id: string;
  emoji: string;
  title: string;
  subtopics: SubTopic[];
}

const TOPICS: Topic[] = [
  {
    id: 'autocuidado',
    emoji: '🧘',
    title: 'Practicar autocuidado',
    subtopics: [
      {
        title: 'Cuidando mis emociones',
        body: 'Reconocer lo que sentimos como docentes es el primer paso para acompañar a nuestras y nuestros estudiantes. Date permiso de nombrar tus emociones sin juzgarlas.',
      },
      {
        title: 'Cuidando mi cuerpo',
        body: 'El descanso, la alimentación y el movimiento sostienen tu bienestar. Pequeñas pausas durante la jornada ayudan a regular el estrés.',
      },
      {
        title: 'Cuidando mi mente',
        body: 'Practicar la atención plena, poner límites sanos y buscar apoyo cuando lo necesitas protege tu salud mental a largo plazo.',
      },
    ],
  },
  {
    id: 'salud-mental',
    emoji: '🧠',
    title: '¿Por qué importa la salud mental en la infancia?',
    subtopics: [
      {
        title: '¿Qué son las emociones?',
        body: 'Las emociones son respuestas naturales que nos informan sobre lo que vivimos. No son buenas ni malas: todas tienen algo que decirnos.',
      },
      {
        title: 'Todas las emociones tienen una función',
        body: 'El miedo nos protege, la tristeza nos invita a buscar consuelo, el enojo señala límites. Acompañar emociones es ayudar a comprender su mensaje.',
      },
    ],
  },
  {
    id: 'aula',
    emoji: '🏫',
    title: 'Cómo acompañar emociones difíciles en el aula',
    subtopics: [
      {
        title: 'Estrategias prácticas para docentes',
        body: 'Validar lo que siente el estudiante, ofrecer un espacio seguro y proponer recursos como la respiración o el dibujo ayudan a regular emociones intensas.',
      },
      {
        title: 'Qué hacer y qué evitar cuando un estudiante expresa emociones',
        body: 'Escucha sin minimizar ni apresurar soluciones. Evita frases como "no es para tanto" y acompaña con presencia y calma.',
      },
      {
        title: 'Recomendaciones para promover espacios seguros y respetuosos',
        body: 'Acuerdos de convivencia, rutinas predecibles y un clima de respeto permiten que niñas, niños y adolescentes se sientan en confianza para expresarse.',
      },
    ],
  },
];

export default function AprendiendoBienestarScreen() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader paddingTop={insets.top + 16} paddingBottom={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Sueños y Letras</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
              Aprendiendo sobre bienestar emocional
            </Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
          Esta sección busca fortalecer los conocimientos y herramientas de las docentes para acompañar
          procesos de bienestar emocional en sus comunidades educativas.
        </Text>

        <VideoPlaceholder caption="Video de introducción (~1 minuto)" />

        {TOPICS.map((topic) => (
          <View key={topic.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 20 }}>{topic.emoji}</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: colors.textDark }}>
                {topic.title}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {topic.subtopics.map((sub, idx) => {
                const key = `${topic.id}-${idx}`;
                const isOpen = open === key;
                return (
                  <View
                    key={key}
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#fff',
                      borderWidth: 1.5,
                      borderColor: isOpen ? colors.brand : colors.borderSoft,
                    }}>
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : key)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                      }}>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          fontWeight: isOpen ? '700' : '500',
                          color: isOpen ? colors.brand : colors.textDark,
                          lineHeight: 18,
                        }}>
                        {sub.title}
                      </Text>
                      <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                        <Icon name="chevron-down" size={16} color={isOpen ? colors.brand : colors.textMuted} />
                      </View>
                    </Pressable>
                    {isOpen ? (
                      <View
                        style={{
                          paddingHorizontal: 16,
                          paddingBottom: 16,
                          borderTopWidth: 1,
                          borderTopColor: colors.borderSoft,
                        }}>
                        <Text style={{ marginTop: 10, fontSize: 12.5, color: colors.textBody, lineHeight: 20 }}>
                          {sub.body}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
