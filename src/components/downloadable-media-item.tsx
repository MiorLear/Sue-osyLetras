import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** Icon for a document by its mime type. */
function iconFor(mimeType?: string): 'file-text' | 'image' | 'video' | 'volume' {
  if (!mimeType) return 'file-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'volume';
  return 'file-text';
}

/** Tap-to-open row for a real uploaded file. Opens the public URL in an in-app
 * browser — this reliably previews PDFs/images/video on both iOS and Android
 * (Android blocks opening downloaded file:// URIs directly). */
export function DownloadableMediaItem({ item }: { item: MediaItem }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!item.url) {
      Alert.alert('Documento no disponible', 'Este archivo aún no tiene un enlace válido.');
      return;
    }
    setBusy(true);
    try {
      await WebBrowser.openBrowserAsync(item.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
    } catch {
      Alert.alert('No se pudo abrir el documento', 'Verifica tu conexión e inténtalo de nuevo.');
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
