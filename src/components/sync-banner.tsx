import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { useSync } from '@/lib/sync-status';

// Thin status strip pinned to the very top (rendered as an absolute overlay in
// the root layout so it never reflows the screens below). Shows only when it
// has something to say: "Sincronizando…" while a sync runs, or an offline
// notice when there's no connection. Hidden when online and idle.
export function SyncBanner() {
  const insets = useSafeAreaInsets();
  const { online, syncing } = useSync();

  if (online && !syncing) return null;

  const offline = !online;
  const bg = offline ? '#FBEAE6' : colors.navBg;
  const fg = offline ? colors.danger : colors.brandDark;
  const label = offline ? 'Sin conexión — mostrando contenido guardado' : 'Sincronizando…';

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: insets.top,
        backgroundColor: bg,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 5,
          paddingHorizontal: 12,
        }}>
        {offline ? null : <Icon name="repeat" size={12} color={fg} strokeWidth={2.4} />}
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: fg }}>{label}</Text>
      </View>
    </View>
  );
}
