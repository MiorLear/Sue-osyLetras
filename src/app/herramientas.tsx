import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaItem } from '@explorarte/shared';
import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { DownloadableMediaItem } from '@/components/downloadable-media-item';
import { GradientHeader } from '@/components/gradient-header';
import { Icon } from '@/components/icon';
import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { download, getLocalUri, isDownloaded } from '@/lib/offlineStorage';

function ManualButton({ manual }: { manual: MediaItem | null }) {
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (manual) isDownloaded(manual.id).then(setDownloaded);
  }, [manual?.id]);

  if (!manual) {
    return (
      <Pressable
        onPress={() => Alert.alert('Aún no disponible')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.disabled ?? '#CBD5D5' }}>
        <Icon name="download" size={14} color="#fff" strokeWidth={2.2} />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Descargar</Text>
      </Pressable>
    );
  }

  const handlePress = async () => {
    if (downloaded) {
      const uri = await getLocalUri(manual.id);
      if (uri) Linking.openURL(uri).catch(() => Alert.alert('No se pudo abrir el archivo'));
      return;
    }
    setBusy(true);
    try {
      const uri = await download(manual.id, manual.url);
      setDownloaded(true);
      Linking.openURL(uri).catch(() => {});
    } catch {
      Alert.alert('No se pudo descargar', 'Verifica tu conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.brand, opacity: busy ? 0.7 : 1 }}>
      <Icon name={downloaded ? 'check-circle' : 'download'} size={14} color="#fff" strokeWidth={2.2} />
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
        {busy ? 'Descargando…' : downloaded ? 'Ver PDF' : 'Descargar'}
      </Text>
    </Pressable>
  );
}

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

export default function CajaDeHerramientasScreen() {
  const insets = useSafeAreaInsets();
  const { data: tools, loading, error, reload } = useAsync(() => api.tools.get(), []);
  const { data: intro } = useAsync(() => api.screenIntros.get('tools'), []);
  const introVideo = intro?.video ?? null;

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

        <VideoPlaceholder
          caption="Video de introducción – Cómo usar los recursos disponibles (~1 minuto)"
          videoItem={introVideo}
        />

        {tools ? (
          <>
            <SectionCard emoji="📖" title="Manual ExplorArte" subtitle="Documento principal de la metodología.">
              <ManualButton manual={tools.manualDocument} />
            </SectionCard>

            <SectionCard emoji="📋" title="Guías de actividades" subtitle="Materiales complementarios para docentes.">
              {tools.activityGuides.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textBody }}>Aún no hay guías subidas.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {tools.activityGuides.map((item) => (
                    <DownloadableMediaItem key={item.id} item={item} />
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard emoji="📥" title="Recursos descargables">
              {tools.downloadables.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textBody }}>Aún no hay recursos subidos.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {tools.downloadables.map((item) => (
                    <DownloadableMediaItem key={item.id} item={item} />
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard
              emoji="📚"
              title="Bibliografía recomendada"
              subtitle="Selección de lecturas para profundizar en bienestar emocional, desarrollo socioemocional y educación.">
              {tools.bibliography.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textBody }}>Aún no hay bibliografía sugerida.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {tools.bibliography.map((b) => (
                    <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Icon name="book-open" size={15} color={colors.brand} />
                      <Text style={{ flex: 1, fontSize: 12.5, color: colors.textBody, lineHeight: 18 }}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>
          </>
        ) : loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={{ marginTop: 32, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
              No pudimos cargar las herramientas. Revisa tu conexión.
            </Text>
            <Pressable
              onPress={reload}
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.textMuted }}>
            Aún no hay herramientas disponibles.
          </Text>
        )}
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
