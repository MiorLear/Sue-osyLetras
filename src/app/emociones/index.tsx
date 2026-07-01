import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Emotion } from '@explorarte/shared';
import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { GradientHeader } from '@/components/gradient-header';
import { Logo } from '@/components/logo';
import { VideoPlaceholder } from '@/components/video-placeholder';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';

export default function BibliotecaDeEmocionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [emotions, setEmotions] = useState<Emotion[]>([]);

  useEffect(() => {
    api.emotions.list().then(setEmotions);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GradientHeader paddingTop={insets.top + 16} paddingBottom={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={40} />
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Sueños y Letras</Text>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Biblioteca de emociones</Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
          Las emociones forman parte de nuestra vida cotidiana. Reconocerlas, nombrarlas y
          comprenderlas es el primer paso para desarrollar bienestar emocional y construir relaciones
          saludables.
          {'\n\n'}
          Esta sección reúne recursos para comprender distintas emociones y acompañar conversaciones
          significativas dentro del aula.
        </Text>

        <VideoPlaceholder caption="Video de introducción – ¿Por qué es importante reconocer las emociones? (~1 minuto)" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {emotions.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/emociones/${e.id}` as never)}
              style={({ pressed }) => ({
                width: '47.8%',
                flexGrow: 1,
                borderRadius: 16,
                paddingVertical: 22,
                alignItems: 'center',
                gap: 8,
                backgroundColor: e.bg,
                borderWidth: 1.5,
                borderColor: e.color + '40',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}>
              <Text style={{ fontSize: 44 }}>{e.emoji}</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textDark }}>{e.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}
