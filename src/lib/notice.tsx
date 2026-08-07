import { useSyncExternalStore } from 'react';
import { Modal, Pressable, Text } from 'react-native';

import { colors } from '@/constants/theme';

// Cross-platform replacement for `Alert.alert` (BUG-02).
//
// react-native-web ships Alert as `class Alert { static alert() {} }` — a
// no-op. Nothing throws and nothing logs, so every confirmation and every
// failure message the app showed was *completely silent* on the deployed web
// export, including "Guardado sin conexión" and "No disponible sin conexión".
//
// The shape is a module-level store plus a single host mounted in the root
// layout, so `showNotice` is callable from anywhere — event handlers, catch
// blocks, plain async modules — without prop-drilling or a context. Notices
// queue instead of overwriting each other: two failures in a row are two
// messages, not one.

export interface Notice {
  title: string;
  message?: string;
}

let current: Notice | null = null;
const waiting: Notice[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Shows a message to the user. Works on native and on web, unlike Alert.alert. */
export function showNotice(title: string, message?: string): void {
  const notice = { title, message };
  if (current) waiting.push(notice);
  else current = notice;
  emit();
}

/** Dismisses the visible notice and promotes the next queued one. */
export function dismissNotice(): void {
  current = waiting.shift() ?? null;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getCurrent = (): Notice | null => current;

/** Reactive: the notice being shown, or null. */
export function useNotice(): Notice | null {
  return useSyncExternalStore(subscribe, getCurrent, getCurrent);
}

/** Renders the current notice. Mount once, in the root layout. */
export function NoticeHost() {
  const notice = useNotice();
  if (!notice) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissNotice}>
      <Pressable
        onPress={dismissNotice}
        style={{
          flex: 1,
          backgroundColor: 'rgba(20,40,38,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 16,
            backgroundColor: '#fff',
            padding: 20,
            gap: 8,
          }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark }}>{notice.title}</Text>
          {notice.message ? (
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textBody }}>{notice.message}</Text>
          ) : null}
          <Pressable
            onPress={dismissNotice}
            style={{
              marginTop: 8,
              alignSelf: 'flex-end',
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 10,
              backgroundColor: colors.brand,
            }}>
            <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>Entendido</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
