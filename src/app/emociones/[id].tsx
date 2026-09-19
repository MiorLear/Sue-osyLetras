import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EmotionActivity } from '@explorarte/shared';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { DownloadableMediaItem } from '@/components/downloadable-media-item';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: 18 }} />;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark }}>{children}</Text>;
}

/**
 * Una actividad, como tarjeta.
 *
 * Resumen: nombre, propósito, duración y edades. Al abrirla: objetivo,
 * materiales, paso a paso y preguntas para conversar. Cada cosa sale de su
 * campo, y lo que el material no diga no se dibuja — una docente planifica con
 * la duración y la edad que lee, así que un valor por defecto plausible es peor
 * que un hueco.
 */
function ActivityCard({
  activity,
  color,
  bg,
}: {
  activity: EmotionActivity;
  color: string;
  bg: string;
}) {
  const [open, setOpen] = useState(false);
  const { title, purpose, duration, ages, materials, steps, questions } = activity;
  const chips = [duration ? `⏱ ${duration}` : null, ages ? `👧 ${ages}` : null].filter(
    (chip): chip is string => chip !== null,
  );
  // Sin nada que desplegar, el botón abriría un panel vacío.
  const hasDetail = Boolean(materials || steps.length || questions.length || purpose);

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: open ? color : colors.border }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
            <Icon name="edit" size={15} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textDark }}>{title}</Text>
            {purpose ? (
              <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12.5, lineHeight: 19, color: colors.textBody }}>{purpose}</Text>
            ) : null}
          </View>
        </View>

        {chips.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {chips.map((label) => (
              <Text key={label} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: bg, fontSize: 10.5, fontWeight: '600', color: colors.textBody }}>{label}</Text>
            ))}
          </View>
        ) : null}

        {hasDetail ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((value) => !value)}
            style={{ marginTop: 13, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '800' }}>
              {open ? 'Ocultar actividad' : 'Ver actividad'}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ marginTop: 13, fontSize: 12, color: colors.textMuted }}>Sin detalle todavía</Text>
        )}
      </View>

      {open && hasDetail ? (
        <View style={{ padding: 16, backgroundColor: '#FAFDFD', borderTopWidth: 1, borderTopColor: colors.borderSoft, gap: 13 }}>
          {purpose ? <Detail label="Objetivo" value={purpose} /> : null}
          {duration ? <Detail label="Duración" value={duration} /> : null}
          {ages ? <Detail label="Edades" value={ages} /> : null}
          {materials ? <Detail label="Materiales" value={materials} /> : null}

          {steps.length > 0 ? (
            <View>
              <DetailLabel>Paso a paso</DetailLabel>
              <View style={{ marginTop: 6, gap: 7 }}>
                {steps.map((step, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 9 }}>
                    <Text style={{ width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, backgroundColor: bg, color, fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
                    <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.textBody }}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {questions.length > 0 ? (
            <View>
              <DetailLabel>Preguntas para conversar</DetailLabel>
              <View style={{ marginTop: 6, gap: 6 }}>
                {questions.map((question) => (
                  <View key={question} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color, fontWeight: '800' }}>•</Text>
                    <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.textBody }}>{question}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DetailLabel({ children }: { children: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textDark, textTransform: 'uppercase' }}>{children}</Text>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <DetailLabel>{label}</DetailLabel>
      <Text style={{ marginTop: 4, fontSize: 12.5, lineHeight: 19, color: colors.textBody }}>{value}</Text>
    </View>
  );
}

export default function EmotionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: emotion, loading, error, reload } = useOfflineAsync(`emotion:${id}`, () => api.emotions.get(id!), [id]);

  const data = emotion?.content;

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
            <SectionTitle>Actividades para explorar esta emoción</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.activities.map((a, i) => (
                <ActivityCard
                  key={i}
                  activity={a}
                  color={emotion?.color ?? colors.brand}
                  bg={emotion?.bg ?? colors.navBg}
                />
              ))}
            </View>

            <Divider />
            <SectionTitle>Historias sugeridas</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.stories.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Aún no hay historias subidas para esta emoción.
                </Text>
              ) : (
                data.stories.map((s) => <DownloadableMediaItem key={s.id} item={s} />)
              )}
            </View>
          </>
        ) : loading ? (
          <ActivityIndicator color={emotion?.color ?? colors.brand} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={{ marginTop: 40, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
              No pudimos cargar esta emoción. Revisa tu conexión.
            </Text>
            <Pressable
              onPress={reload}
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
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
