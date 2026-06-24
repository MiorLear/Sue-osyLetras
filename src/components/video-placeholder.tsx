import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

// Video demo reproducido al tocar cualquier marcador de posición de video.
const DEMO_VIDEO = require('@/assets/video/demo.mp4');

// Marcador de posición de video: muestra ▶ + caption y reproduce el demo al tocarlo.
export function VideoPlaceholder({ caption }: { caption: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          borderRadius: 16,
          paddingVertical: 28,
          paddingHorizontal: 20,
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#EAF4F3',
          borderWidth: 1.5,
          borderColor: colors.borderSoft,
          borderStyle: 'dashed',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand,
          }}>
          <Icon name="play" size={22} fill="#fff" />
        </View>
        <Text style={{ fontSize: 12.5, color: colors.textBody, textAlign: 'center', lineHeight: 18 }}>
          {caption}
        </Text>
      </Pressable>

      {open ? <FullscreenPlayer caption={caption} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FullscreenPlayer({ caption, onClose }: { caption: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(DEMO_VIDEO, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: '#0A0A0A', zIndex: 50 }}>
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        nativeControls
      />
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Reproduciendo
          </Text>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={2}>
            {caption}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Icon name="x" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
