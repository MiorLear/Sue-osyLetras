import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EmotionDetail } from '@explorarte/shared';
import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { DownloadableMediaItem } from '@/components/downloadable-media-item';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';

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
  const [emotion, setEmotion] = useState<EmotionDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    api.emotions.get(id).then(setEmotion);
  }, [id]);

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
              {data.stories.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Aún no hay historias subidas para esta emoción.
                </Text>
              ) : (
                data.stories.map((s) => <DownloadableMediaItem key={s.id} item={s} />)
              )}
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
