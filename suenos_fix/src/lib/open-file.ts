import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Opens a locally cached file. The browser uses a blob/object URL in a new tab;
// iOS/Android use the native viewer/share mechanisms.
export async function openLocalFile(uri: string, mimeType?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const opened = window.open(uri, '_blank', 'noopener,noreferrer');
      return !!opened;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mimeType || undefined,
      });
      return true;
    } catch {
      // No viewer app for ACTION_VIEW (or an error) → fall through to sharing.
    }
  }

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: mimeType || undefined });
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
