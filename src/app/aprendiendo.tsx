import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { DownloadableMediaItem } from '@/components/downloadable-media-item';
import { GradientHeader } from '@/components/gradient-header';
import { Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

export default function AprendiendoBienestarScreen() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const { data: topics, loading, error, reload } = useAsync(() => api.learning.topics(), []);
  const { data: intro } = useAsync(() => api.screenIntros.get('learning'), []);
  const introVideo = intro?.video ?? null;

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

        <VideoPlaceholder caption="Video de introducción (~1 minuto)" videoItem={introVideo} />

        {topics && topics.length > 0 ? (
          topics.map((topic) => (
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
                        {[...sub.pdfs, ...sub.videos, ...sub.audios].length > 0 ? (
                          <View style={{ marginTop: 12, gap: 8 }}>
                            {[...sub.pdfs, ...sub.videos, ...sub.audios].map((m) => (
                              <DownloadableMediaItem key={m.id} item={m} />
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
          ))
        ) : loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={{ marginTop: 32, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
              No pudimos cargar los temas. Revisa tu conexión.
            </Text>
            <Pressable
              onPress={reload}
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
            Aún no hay temas disponibles.
          </Text>
        )}
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
