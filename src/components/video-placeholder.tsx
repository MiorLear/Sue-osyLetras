import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { download, getLocalUri } from '@/lib/offlineStorage';

// videoItem is null until an admin uploads a real intro video for this screen
// (web /admin/videos-intro) — hide the placeholder entirely rather than show
// a broken/empty state, matching the equivalent web decision.
export function VideoPlaceholder({ caption, videoItem }: { caption: string; videoItem: MediaItem | null }) {
  const [open, setOpen] = useState(false);

  if (!videoItem) return null;

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

      {open ? <FullscreenPlayer item={videoItem} caption={caption} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FullscreenPlayer({ item, caption, onClose }: { item: MediaItem; caption: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // Same tap-to-download-then-play pattern as every other piece of content —
  // on-demand, not pre-fetched in the background, so a downloaded video plays
  // fully offline on the next open with zero network requests.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await getLocalUri(item.id);
      if (local) {
        if (!cancelled) setUri(local);
        return;
      }
      try {
        const downloaded = await download(item.id, item.url);
        if (!cancelled) setUri(downloaded);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.url]);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (uri) player.play();
  }, [uri, player]);

  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: '#0A0A0A', zIndex: 50 }}>
      {uri ? (
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          nativeControls
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {error ? 'No se pudo descargar el video' : 'Descargando video…'}
          </Text>
        </View>
      )}
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
