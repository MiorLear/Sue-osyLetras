import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { getLocalUri } from '@/lib/offlineStorage';

// videoItem is null until an admin uploads a real intro video for this screen
// (web /admin/videos-intro) — hide the card entirely rather than show a
// broken/empty state, matching the equivalent web decision.
export function VideoPlaceholder({ caption, videoItem }: { caption: string; videoItem: MediaItem | null }) {
  if (!videoItem) return null;
  return <VideoCard item={videoItem} caption={caption} />;
}

function VideoCard({ item, caption }: { item: MediaItem; caption: string }) {
  const [open, setOpen] = useState(false);

  // Local-first: play the downloaded file if it's cached (works offline),
  // otherwise stream the remote URL. media-sync pre-downloads intro videos, so
  // this normally resolves to the local copy.
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getLocalUri(item.id).then((local) => {
      if (active) setSource(local ?? item.url);
    });
    return () => {
      active = false;
    };
  }, [item.id, item.url]);

  // A paused player renders the first frame, which serves as the thumbnail/poster.
  const preview = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = false;
  });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderSoft,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          backgroundColor: '#0A0A0A',
        })}>
        <VideoView
          player={preview}
          style={{ width: '100%', height: 196 }}
          contentFit="cover"
          nativeControls={false}
        />
        {/* darkening + play affordance + caption, over the poster frame */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        />
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.92)',
            }}>
            <Icon name="play" size={24} fill={colors.brand} color={colors.brand} />
          </View>
        </View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>VIDEO</Text>
          </View>
          <Text style={{ flex: 1, color: '#fff', fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      </Pressable>

      {open ? <FullscreenPlayer source={source ?? item.url} caption={caption} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FullscreenPlayer({ source, caption, onClose }: { source: string; caption: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  // Plays the local file when cached (offline), else streams as it buffers.
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    player.play();
  }, [player]);

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
