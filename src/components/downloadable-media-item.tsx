import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { MediaItem } from '@explorarte/shared';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { download, getLocalUri, isDownloaded } from '@/lib/offlineStorage';

/** Tap-to-download-then-open row for a real uploaded file. Once downloaded,
 * reopening never re-fetches — it opens straight from the local file, which
 * is what makes offline viewing work. */
export function DownloadableMediaItem({ item }: { item: MediaItem }) {
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isDownloaded(item.id).then(setDownloaded);
  }, [item.id]);

  const open = async () => {
    const uri = await getLocalUri(item.id);
    if (!uri) return;
    try {
      await Linking.openURL(uri);
    } catch {
      Alert.alert('No se pudo abrir el archivo');
    }
  };

  const handlePress = async () => {
    if (downloaded) {
      await open();
      return;
    }
    setBusy(true);
    try {
      await download(item.id, item.url);
      setDownloaded(true);
      await open();
    } catch {
      Alert.alert('No se pudo descargar', 'Verifica tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: colors.bg,
        borderWidth: 1.5,
        borderColor: colors.borderSoft,
      }}>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark }}>{item.title}</Text>
      <Pressable
        onPress={handlePress}
        disabled={busy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 9,
          backgroundColor: downloaded ? colors.brand : '#fff',
          borderWidth: 1.5,
          borderColor: colors.brand,
          opacity: busy ? 0.6 : 1,
        }}>
        <Icon name={downloaded ? 'check-circle' : 'download'} size={13} color={downloaded ? '#fff' : colors.brand} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: downloaded ? '#fff' : colors.brand }}>
          {busy ? 'Descargando…' : downloaded ? 'Ver' : 'Descargar'}
        </Text>
      </Pressable>
    </View>
  );
}
