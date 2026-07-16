import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/sync-banner';
import { colors } from '@/constants/theme';
import { syncAllContent } from '@/lib/media-sync';
import { flushQueue, loadQueue } from '@/lib/mutation-queue';
import { useIsOnline } from '@/lib/useNetworkStatus';

export default function RootLayout() {
  const online = useIsOnline();

  // Load any pending offline changes on launch so the banner can reflect them.
  useEffect(() => {
    void loadQueue();
  }, []);

  // When there's a connection (launch + reconnect): pull content/media for
  // offline use and replay any queued offline changes. The banner shows progress.
  useEffect(() => {
    if (online) {
      void syncAllContent();
      void flushQueue();
    }
  }, [online]);

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
    </SafeAreaProvider>
  );
}
