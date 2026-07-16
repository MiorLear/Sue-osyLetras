import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { download, getLocalUri } from '@/lib/offlineStorage';
import { useIsOnline } from '@/lib/useNetworkStatus';

/** Icon for a document by its mime type. */
function iconFor(mimeType?: string): 'file-text' | 'image' | 'video' | 'volume' {
  if (!mimeType) return 'file-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'volume';
  return 'file-text';
}

/** Tap-to-open row for a real uploaded file. Opens the downloaded local copy
 * with the device's own viewer (PDF reader, gallery, player) — same as opening
 * a file you saved on your phone — so it works offline. If the file isn't
 * cached yet and there's a connection, it's downloaded first; as a last resort
 * (online, sharing unavailable) it opens remotely in the in-app browser. */
export function DownloadableMediaItem({ item }: { item: MediaItem }) {
  const online = useIsOnline();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      // 1. Local copy first (offline-friendly); download on demand if online.
      let uri = await getLocalUri(item.id);
      if (!uri && online && item.url) {
        try {
          uri = await download(item.id, item.url, { version: String(item.sizeBytes ?? '') });
        } catch {
          uri = null;
        }
      }
      // 2. Hand the local file to the OS to open with its native viewer.
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: item.mimeType || undefined });
        return;
      }
      // 3. Fallback: open remotely when online.
      if (online && item.url) {
        await WebBrowser.openBrowserAsync(item.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
        return;
      }
      Alert.alert(
        'No disponible sin conexión',
        'Conéctate a internet una vez para descargar este archivo; luego podrás abrirlo sin conexión.',
      );
    } catch {
      Alert.alert('No se pudo abrir el documento', 'Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={open}
      disabled={busy}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: pressed ? colors.navBg : colors.bg,
        borderWidth: 1.5,
        borderColor: colors.borderSoft,
        opacity: busy ? 0.6 : 1,
      })}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: colors.borderSoft,
        }}>
        <Icon name={iconFor(item.mimeType)} size={17} color={colors.brand} />
      </View>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark }} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name="eye" size={14} color={colors.brand} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>
          {busy ? 'Abriendo…' : 'Ver'}
        </Text>
      </View>
    </Pressable>
  );
}
