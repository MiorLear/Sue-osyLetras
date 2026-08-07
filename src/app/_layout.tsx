import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/sync-banner';
import { colors } from '@/constants/theme';
import { maybeSyncContent } from '@/lib/media-sync';
import { NoticeHost } from '@/lib/notice';
import { flushQueueNow, loadQueue, startOutboxRetries } from '@/lib/mutation-queue';
import { useIsMetered, useIsOnline } from '@/lib/useNetworkStatus';

export default function RootLayout() {
  const online = useIsOnline();
  const metered = useIsMetered();

  // Load any pending offline changes on launch so the banner can reflect them,
  // then start the retry ladder: it flushes once right away (a device that boots
  // already-online with a queue used to never retry) and keeps a backoff timer
  // armed for as long as work is pending.
  useEffect(() => {
    void loadQueue();
    return startOutboxRetries();
  }, []);

  // Returning to the foreground is the other moment worth retrying: the tablet
  // may have been asleep through the whole backoff window.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushQueueNow();
    });
    return () => sub.remove();
  }, []);

  // When there's a connection (launch + reconnect): refresh the cached content
  // JSON and replay any queued offline changes. The refresh is throttled and
  // skips metered connections, because `online` flips constantly on a tablet
  // moving between Wi-Fi and cellular; downloading the media files themselves is
  // a separate, user-initiated action (see the profile screen).
  useEffect(() => {
    if (online) {
      void maybeSyncContent({ metered });
      flushQueueNow();
    }
  }, [online, metered]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <SyncBanner />
      <NoticeHost />
    </SafeAreaProvider>
  );
}
