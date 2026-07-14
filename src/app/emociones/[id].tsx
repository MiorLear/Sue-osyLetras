import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { DownloadableMediaItem } from '@/components/downloadable-media-item';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: 18 }} />;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textDark }}>{children}</Text>;
}

const ACTIVITY_LABEL =
  /^(objetivo|duración|duracion|edades|materiales|instrucciones|desarrollo|reflexión|reflexion|preguntas para reflexionar|preguntas para conversar|cómo jugar|como jugar|variante)/i;

// Activities arrive as rich multi-line text (title + Objetivo/Duración/Instrucciones/…).
// Render the first line as the card title and the rest as body, emphasizing labels.
function ActivityCard({ text, color, bg }: { text: string; color: string; bg: string }) {
  const lines = text.split('\n');
  const title = lines[0];
  const body = lines.slice(1);
  return (
    <View
      style={{
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.border,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: body.length ? 10 : 0 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bg,
          }}>
          <Icon name="edit" size={14} color={color} />
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: colors.textDark }}>{title}</Text>
      </View>
      {body.map((line, i) => {
        const label = ACTIVITY_LABEL.test(line.trim());
        return (
          <Text
            key={i}
            style={{
              fontSize: 12.5,
              lineHeight: 18,
              marginTop: label && i > 0 ? 6 : 2,
              color: label ? colors.textDark : colors.textBody,
              fontWeight: label ? '700' : '400',
            }}>
            {line}
          </Text>
        );
      })}
    </View>
  );
}

export default function EmotionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: emotion, loading, error, reload } = useAsync(() => api.emotions.get(id!), [id]);

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
            <SectionTitle>Actividades recomendadas</SectionTitle>
            <View style={{ marginTop: 10, gap: 8 }}>
              {data.activities.map((a, i) => (
                <ActivityCard
                  key={i}
                  text={a}
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
