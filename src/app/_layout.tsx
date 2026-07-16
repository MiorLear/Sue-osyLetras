import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/sync-banner';
import { colors } from '@/constants/theme';
import { syncAllContent } from '@/lib/media-sync';
import { useIsOnline } from '@/lib/useNetworkStatus';

export default function RootLayout() {
  const online = useIsOnline();

  // Pull content + media for offline use whenever there's a connection (on
  // launch and on reconnect). Runs in the background; the banner shows progress.
  useEffect(() => {
    if (online) void syncAllContent();
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
