import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { discardFailedMutations, useFailedCount, usePendingCount } from '@/lib/mutation-queue';
import { useSync } from '@/lib/sync-status';

// Thin status strip pinned to the very top (rendered as an absolute overlay in
// the root layout so it never reflows the screens below). Shows only when it
// has something to say: changes the server rejected for good, "Sincronizando…"
// while a sync runs, or an offline notice when there's no connection. Hidden
// when online, idle and with nothing parked.
export function SyncBanner() {
  const insets = useSafeAreaInsets();
  const { online, syncing } = useSync();
  const pending = usePendingCount();
  const failed = useFailedCount();

  // Changes that will never sync outrank everything else: they are the only
  // state that needs the teacher to do something, and they used to be invisible
  // — silently counted as "pending" forever while they blocked the queue.
  if (failed > 0) {
    return (
      <FailedStrip
        top={insets.top}
        count={failed}
        onDiscard={() => {
          void discardFailedMutations();
        }}
      />
    );
  }

  if (online && !syncing) return null;

  const offline = !online;
  const bg = offline ? '#FBEAE6' : colors.navBg;
  const fg = offline ? colors.danger : colors.brandDark;
  const label = offline
    ? pending > 0
      ? `Sin conexión — ${pending} cambio${pending === 1 ? '' : 's'} se sincronizará${pending === 1 ? '' : 'n'} al reconectar`
      : 'Sin conexión — mostrando contenido guardado'
    : 'Sincronizando…';

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

/** Tappable strip for changes the server rejected for good. Discarding is the
 *  only action offered for now — the local copy is already gone, so there is
 *  nothing to restore (retry/edit is PWA-3.7). */
function FailedStrip({ top, count, onDiscard }: { top: number; count: number; onDiscard: () => void }) {
  const label =
    count === 1
      ? 'No se pudo guardar 1 cambio en el servidor'
      : `No se pudieron guardar ${count} cambios en el servidor`;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: top,
        backgroundColor: '#FBEAE6',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 5,
          paddingHorizontal: 12,
        }}>
        <Icon name="x" size={12} color={colors.danger} strokeWidth={2.4} />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: colors.danger }}>{label}</Text>
        <Pressable onPress={onDiscard} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.danger, textDecorationLine: 'underline' }}>
            Descartar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
