import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Opens a local file with the device's own viewer, like tapping a file you
// downloaded on your phone. On Android that's an ACTION_VIEW intent ("abrir
// con…" / opens straight in the default PDF/media viewer); it needs a content://
// URI (a file:// throws on modern Android). On iOS it uses the share/Quick Look
// sheet. If no app can view it (or ACTION_VIEW fails), it falls back to the
// share sheet so the user can still pick something. Returns false if nothing
// could open it.
export async function openLocalFile(uri: string, mimeType?: string): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
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
